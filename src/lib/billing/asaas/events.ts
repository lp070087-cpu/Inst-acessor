import type { Subscription } from "@prisma/client";
import { bll, type CheckoutOrder } from "@/lib/billing/db";
import { getPlanById } from "@/lib/billing/plans";
import { normalizeEmail } from "@/lib/first-access/core";
import { sendAccessReleasedEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/config/site";
import type { ParsedAsaasEvent } from "./webhook";
import { sanitizeAsaasPayload } from "./client";
import { acceptableChargeAmounts } from "@/lib/billing/promo";
import { getPromoConfig } from "@/lib/billing/promo-db";

/**
 * ASAAS — PROCESSADOR DE EVENTOS (webhook) — OFICIAL
 * =====================================================
 * Reconciliação do checkout hospedado oficial (POST /v3/checkouts):
 *
 *   CheckoutOrder (local, PENDING) ──externalReference──▶ cobrança Asaas
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED ──▶ valida valor/plano no SERVIDOR ──▶
 *   libera/renova acesso:
 *     • comprador COM User → Subscription ACTIVE + AccessGrant;
 *     • comprador SEM User → AccessGrant por E-MAIL (userId null) →
 *       primeiro acesso cria a conta.
 *
 * REGRAS (escopo oficial):
 *  1. Nunca confia em `userId`/preço/plano do payload. O pedido é localizado
 *     pela `externalReference`; valor/duração/ciclo vêm do CATÁLOGO do servidor.
 *  2. Idempotência por claim-first (`BillingEvent.eventId` @@unique): replays
 *     retornam `duplicate` e NUNCA reprocessam.
 *  3. Regra 13 (bug corrigido): `processed=true` SOMENTE após o efeito aplicado
 *     OU classificação consciente de no-effect. Falha mantém `processed=false`
 *     (reprocessável/auditável).
 *  4. Regra 14: valor/plano/referência divergentes → NUNCA libera acesso.
 *  5. Regras 15/16 (bugs corrigidos): NENHUM fallback amountCents=0 ou
 *     durationDays=7 arbitrário. Datas/valor vêm do pedido + catálogo.
 *  6. Regra 17: CONFIRMED e RECEIVED do MESMO pagamento não duplicam direito.
 *  7. Regras 18/20: renovação recorrente estende o acesso UMA vez por cobrança;
 *     cancelamento da renovação futura NÃO apaga período já pago.
 *  8. Regra 19: estorno revoga o acesso da cobrança estornada (por grant).
 */

type ApplyOutcome =
  | "applied"
  | "duplicate_payment"
  | "ignored"
  | "noop";

export interface HandleAsaasEventResult {
  /** true se o evento JÁ havia sido processado com sucesso (replay). */
  duplicate: boolean;
  /** true se o processamento FALHOU (route deve responder 5xx p/ reentrega). */
  failed: boolean;
  outcome: ApplyOutcome | null;
}

interface EventClaimRow {
  id: string;
  processed: boolean;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------

export async function handleAsaasEvent(
  parsed: ParsedAsaasEvent
): Promise<HandleAsaasEventResult> {
  // 1) CLAIM (processed:false) — idempotência por eventId único.
  //    Se o eventId já existir com processed:false (falha anterior), REPROCESSA
  //    a mesma linha em vez de tratar como duplicado (regra 13: falhas ficam
  //    reprocessáveis). Se processed:true → replay, não reprocessa.
  let claim: { id: string };
  let isRetry = false;
  try {
    claim = (await bll.billingEvent.create({
      data: {
        eventId: parsed.eventId,
        provider: "asaas",
        type: parsed.event,
        userId: null,
        subscriptionId: null,
        payload: sanitizeAsaasPayload(parsed.raw),
        processed: false,
      },
    })) as unknown as { id: string };
  } catch {
    const existing = (await bll.billingEvent.findUnique({
      where: { eventId: parsed.eventId },
      select: { id: true, processed: true },
    })) as unknown as EventClaimRow | null;
    // Sem linha: erro transitório no create (não é violação de unique) → falha
    // reprocessável, não duplicado.
    if (!existing) return { duplicate: false, failed: true, outcome: null };
    if (existing.processed) return { duplicate: true, failed: false, outcome: null };
    claim = { id: existing.id };
    isRetry = true;
  }

  let outcome: ApplyOutcome | null = null;
  let resolvedUserId: string | null = null;
  let resolvedSubscriptionId: string | null = null;

  try {
    outcome = await dispatch(parsed);
    const owner = await resolveOwner(parsed);
    resolvedUserId = owner.userId;
    resolvedSubscriptionId = owner.subscriptionId;
  } catch (err) {
    // Falha ao aplicar → MANTÉM processed:false (regra 13) + aplica erro no
    // payload para auditoria. A rota responde 5xx → o Asaas reenviará.
    console.error("[asaas-events] falha ao aplicar evento", parsed.event, err);
    try {
      const prior = isRetry
        ? (((await bll.billingEvent.findUnique({
            where: { id: claim.id },
            select: { payload: true },
          })) as unknown as { payload: unknown } | null)?.payload ?? {})
        : {};
      await bll.billingEvent.update({
        where: { id: claim.id },
        data: {
          processed: false,
          payload: {
            ...((sanitizeAsaasPayload(parsed.raw) as object | null) ?? {}),
            ...(prior as object),
            applyError:
              err instanceof Error ? err.message : "Erro ao aplicar evento",
            retryCount:
              typeof (prior as { retryCount?: unknown }).retryCount === "number"
                ? ((prior as { retryCount: number }).retryCount + 1)
                : 1,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      });
    } catch (e2) {
      console.error("[asaas-events] falha ao registrar erro do evento", e2);
    }
    return { duplicate: false, failed: true, outcome: null };
  }

  // 6) processed=true somente quando houve efeito ou no-effect consciente.
  try {
    await bll.billingEvent.update({
      where: { id: claim.id },
      data: {
        userId: resolvedUserId ?? null,
        subscriptionId: resolvedSubscriptionId ?? null,
        processed: true,
        processedAt: new Date(),
        payload: {
          ...((sanitizeAsaasPayload(parsed.raw) as object | null) ?? {}),
          outcome,
        },
      },
    });
  } catch (err) {
    console.error("[asaas-events] falha ao finalizar registro do evento", err);
  }

  return { duplicate: false, failed: false, outcome };
}

// ---------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------

async function dispatch(parsed: ParsedAsaasEvent): Promise<ApplyOutcome> {
  const ref = extractReference(parsed);
  const order = ref ? await findOrderByReference(ref) : null;

  // 1) Eventos de pagamento confirmado → fluxo principal (ordem ou renovação).
  if (parsed.event === "PAYMENT_CONFIRMED" || parsed.event === "PAYMENT_RECEIVED") {
    if (order) return applyOrderPayment(parsed, order);
    return applySubscriptionRenewalOnly(parsed);
  }

  // 2) Demais eventos: se há ordem correspondente, aplica nela.
  if (order) return applyOrderLifecycle(parsed, order);

  // 3) Sem ordem → tenta eventos de ciclo de vida na subscription já vinculada.
  return applySubscriptionLifecycleOnly(parsed);
}

// ---------------------------------------------------------------
// Referência / localização
// ---------------------------------------------------------------

function extractReference(parsed: ParsedAsaasEvent): string | null {
  const raw = parsed.raw as {
    payment?: { externalReference?: unknown } | null;
    subscription?: { externalReference?: unknown } | null;
    checkout?: { externalReference?: unknown } | null;
  };
  const ref =
    raw.payment?.externalReference ??
    raw.subscription?.externalReference ??
    raw.checkout?.externalReference ??
    null;
  return typeof ref === "string" && ref.trim().length > 0 ? ref.trim() : null;
}

async function findOrderByReference(
  externalReference: string
): Promise<CheckoutOrder | null> {
  try {
    return (await bll.checkoutOrder.findUnique({
      where: { externalReference },
    })) as unknown as CheckoutOrder | null;
  } catch {
    return null;
  }
}

/**
 * O valor confirmado pelo Asaas é um valor LEGÍTIMO para este plano?
 *
 * Fonte da verdade: o MESMO conjunto fechado que o checkout usa (`promo.ts`).
 * Nunca uma tolerância, nunca "qualquer valor positivo". Se a leitura da
 * configuração de pré-venda falhar, o conjunto degrada para o preço cheio —
 * um pagamento promocional seria recusado (e reentregue/auditável) em vez de
 * liberar acesso por um valor que não conseguimos conferir.
 */
async function isChargeAmountLegitimate(
  slug: string,
  basePriceCents: number,
  amountCents: number
): Promise<boolean> {
  let config;
  try {
    config = await getPromoConfig();
  } catch {
    return amountCents === basePriceCents;
  }
  return acceptableChargeAmounts({ slug, basePriceCents, config }).includes(amountCents);
}

async function findSubscriptionByExternalId(
  externalSubscriptionId: string | null,
  externalPaymentId: string | null
): Promise<Subscription | null> {
  if (!externalSubscriptionId && !externalPaymentId) return null;
  try {
    return (await bll.subscription.findFirst({
      where: {
        OR: [
          externalSubscriptionId
            ? { externalSubscriptionId }
            : { id: "__none__" },
          externalPaymentId ? { externalPaymentId } : { id: "__none__" },
        ],
      },
    })) as unknown as Subscription | null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// Fluxo: ordem + pagamento confirmado (1ª compra ou renovação)
// ---------------------------------------------------------------

async function applyOrderPayment(
  parsed: ParsedAsaasEvent,
  order: CheckoutOrder
): Promise<ApplyOutcome> {
  // ---- Validações (regras 14/15/16 + P17/P21) ----
  if (parsed.amountCents === null) return "ignored";
  if (parsed.amountCents !== order.expectedAmountCents) return "ignored";

  const plan = await getPlanById(order.planId ?? order.planSlug);
  if (!plan || !plan.active) return "ignored";

  // AQUI ESTAVA O DEFEITO DA PRÉ-VENDA (P17/P21).
  // Antes: `if (plan.priceCents !== order.expectedAmountCents) return "ignored"`.
  // Com a promoção ligada, `expectedAmountCents` é o valor PROMOCIONAL — então
  // essa linha comparava o preço CHEIO do catálogo contra o promocional, dava
  // diferente, e o pagamento legítimo de quem comprou na pré-venda era
  // DESCARTADO como divergência. O cliente pagava e não recebia acesso: o pior
  // desfecho possível, e silencioso.
  //
  // A conferência correta é contra o CONJUNTO de valores legítimos daquele
  // plano (cheio + promocional vigente), que é exatamente o conjunto que o
  // checkout poderia ter cobrado. Valor fora dele continua recusado.
  if (!(await isChargeAmountLegitimate(plan.slug, plan.priceCents, parsed.amountCents))) {
    return "ignored";
  }
  if (!parsed.externalPaymentId) return "ignored"; // sem âncora estável

  // ---- Replay exato do mesmo pagamento → não duplica (regra 17) ----
  if (
    order.status === "PAID" &&
    order.externalPaymentId === parsed.externalPaymentId
  ) {
    return "duplicate_payment";
  }

  const buyer = await resolveOrCreateBuyer(order);
  const startAt = parsed.paidAt ? new Date(parsed.paidAt) : new Date();
  const durationDays = plan.durationDays && plan.durationDays > 0 ? plan.durationDays : null;
  const expiresAt = durationDays
    ? new Date(startAt.getTime() + durationDays * DAY_MS)
    : null;

  if (order.status === "PAID") {
    // ---- RENOVAÇÃO (novo pagamento numa ordem já paga) ----
    // Só faz sentido para planos recorrentes. Regras 18/20.
    if (plan.type !== "RECURRING") return "ignored";
    return applyRecurringCharge({ parsed, order, plan, buyer, startAt, expiresAt, durationDays });
  }

  // ---- 1ª compra: marca a ordem PAID ----
  await bll.checkoutOrder.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      externalPaymentId: parsed.externalPaymentId ?? order.externalPaymentId,
      externalSubscriptionId:
        parsed.externalSubscriptionId ?? order.externalSubscriptionId,
      paidAt: startAt,
      audit: {
        step: "payment_confirmed",
        at: new Date().toISOString(),
        event: parsed.event,
        paymentId: parsed.externalPaymentId,
      },
    },
  });

  // ---- Subscription (somente se comprador tem conta) ----
  let subscriptionId: string | null = null;
  if (buyer.userId) {
    const sub = await upsertActiveSubscriptionForCharge({
      parsed,
      order,
      plan,
      buyerUserId: buyer.userId,
      startAt,
      expiresAt,
    });
    subscriptionId = sub?.id ?? null;
  }

  // ---- Payment (somente com User — Payment.userId é FK obrigatória) ----
  await upsertPaidPayment({
    parsed,
    amountCents: order.expectedAmountCents,
    userId: buyer.userId,
    planId: plan.id,
    subscriptionId,
    startAt,
  });

  // ---- AccessGrant (User existe → ACTIVE; sem User → PENDING_FIRST_ACCESS) ----
  await upsertChargeGrant({
    parsed,
    order,
    planName: plan.name,
    planId: plan.id,
    buyer,
    startAt,
    expiresAt,
  });

  return "applied";
}

// ---------------------------------------------------------------
// Renovação recorrente (nova cobrança de uma assinatura ativa)
// ---------------------------------------------------------------

async function applyRecurringCharge(input: {
  parsed: ParsedAsaasEvent;
  order: CheckoutOrder;
  plan: { id: string; slug: string; name: string; type: string; billingInterval: string | null; durationDays: number | null };
  buyer: { userId: string | null; email: string };
  startAt: Date;
  expiresAt: Date | null;
  durationDays: number | null;
}): Promise<ApplyOutcome> {
  const { parsed, order, plan, buyer, startAt, durationDays } = input;

  // Localiza a assinatura (âncora de extensão). Se o comprador ainda não tem
  // conta, não há Subscription local — o grant por e-mail é a âncora.
  let sub = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? order.externalSubscriptionId ?? null,
    order.externalPaymentId ?? null
  );

  // Sem subscription mas o comprador agora tem conta → cria a partir do grant.
  const now = new Date();
  let subscriptionId: string | null = null;

  if (buyer.userId) {
    // Período já pago (se ainda vigente) é a base da extensão (regra 20).
    const paidThrough = sub?.expiresAt && sub.expiresAt.getTime() > now.getTime()
      ? sub.expiresAt
      : null;
    const base = paidThrough && paidThrough.getTime() > startAt.getTime()
      ? paidThrough
      : startAt;
    const newExpiry = durationDays
      ? new Date(base.getTime() + durationDays * DAY_MS)
      : null;

    if (sub) {
      await bll.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          startAt: base,
          expiresAt: newExpiry,
          autoRenew: plan.type === "RECURRING",
          nextBillingAt: computeNextBilling(base, plan.billingInterval),
          externalSubscriptionId:
            parsed.externalSubscriptionId ?? sub.externalSubscriptionId,
          provider: "asaas",
          paidAt: startAt,
        },
      });
      subscriptionId = sub.id;
    } else {
      const created = (await bll.subscription.create({
        data: {
          userId: buyer.userId,
          planId: plan.id,
          status: "ACTIVE",
          billingType: plan.type,
          billingInterval: plan.billingInterval,
          startAt: base,
          expiresAt: newExpiry,
          autoRenew: plan.type === "RECURRING",
          nextBillingAt: computeNextBilling(base, plan.billingInterval),
          provider: "asaas",
          externalPaymentId: order.externalPaymentId ?? parsed.externalPaymentId,
          externalSubscriptionId:
            parsed.externalSubscriptionId ?? order.externalSubscriptionId,
          amountCents: order.expectedAmountCents,
          currency: "BRL",
          paidAt: startAt,
          accessSource: "ASAAS",
        },
      })) as unknown as { id: string };
      subscriptionId = created.id;
    }
  }

  // Payment da nova cobrança (com User apenas — FK obrigatória).
  await upsertPaidPayment({
    parsed,
    amountCents: order.expectedAmountCents,
    userId: buyer.userId,
    planId: plan.id,
    subscriptionId,
    startAt,
  });

  // Grant da nova cobrança: extensão a partir do fim do período vigente.
  const grantStart = await computeGrantStartForEmail(buyer.email, startAt);
  const grantExpiry = durationDays
    ? new Date(grantStart.getTime() + durationDays * DAY_MS)
    : null;

  await upsertChargeGrant({
    parsed,
    order,
    planName: plan.name,
    planId: plan.id,
    buyer,
    startAt: grantStart,
    expiresAt: grantExpiry,
  });

  return "applied";
}

/** Data de início da nova cobrança = fim do período vigente do e-mail (se futuro). */
async function computeGrantStartForEmail(
  email: string,
  fallback: Date
): Promise<Date> {
  try {
    const grants = (await bll.accessGrant.findMany({
      where: { email, origin: "ASAAS", status: { in: ["ACTIVE", "PENDING_FIRST_ACCESS"] } },
      orderBy: { createdAt: "desc" },
      take: 1,
    })) as unknown as { expiresAt: Date | null }[];
    const last = grants[0];
    const now = Date.now();
    if (last?.expiresAt && last.expiresAt.getTime() > now) {
      return last.expiresAt;
    }
  } catch {
    /* segue */
  }
  return fallback;
}

// ---------------------------------------------------------------
// Pagamento confirmado SEM ordem correspondente (renovação direta)
// ---------------------------------------------------------------

async function applySubscriptionRenewalOnly(
  parsed: ParsedAsaasEvent
): Promise<ApplyOutcome> {
  const sub = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? null,
    parsed.externalPaymentId ?? null
  );
  if (!sub) return "noop";

  const plan = await getPlanById(sub.planId);
  if (!plan || !plan.active) return "ignored";
  if (parsed.amountCents === null) return "ignored";
  // Renovação SEM ordem local: aqui o preço de referência é o do catálogo, mas a
  // pré-venda também precisa valer — quem assinou no valor promocional é cobrado
  // assim pelo Asaas, e recusar essa cobrança apagaria o acesso de quem pagou.
  // Mesmo conjunto fechado do checkout (cheio + promocional vigente).
  if (!(await isChargeAmountLegitimate(plan.slug, plan.priceCents, parsed.amountCents))) {
    return "ignored";
  }
  if (!parsed.externalPaymentId) return "ignored";

  // Replay do mesmo pagamento já registrado.
  const existingPayment = (await bll.payment.findFirst({
    where: { externalPaymentId: parsed.externalPaymentId },
    select: { id: true },
  })) as unknown as { id: string } | null;
  if (existingPayment) return "duplicate_payment";

  const user = (await bll.user.findUnique({
    where: { id: sub.userId },
    select: { id: true, email: true },
  })) as unknown as { id: string; email: string } | null;
  if (!user?.email) return "noop";

  const now = new Date();
  const startAt = parsed.paidAt ? new Date(parsed.paidAt) : now;
  const paidThrough =
    sub.expiresAt && sub.expiresAt.getTime() > now.getTime() ? sub.expiresAt : null;
  const base = paidThrough && paidThrough.getTime() > startAt.getTime()
    ? paidThrough
    : startAt;
  const durationDays =
    plan.durationDays && plan.durationDays > 0 ? plan.durationDays : null;
  const newExpiry = durationDays
    ? new Date(base.getTime() + durationDays * DAY_MS)
    : null;

  await bll.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      startAt: base,
      expiresAt: newExpiry,
      autoRenew: plan.type === "RECURRING",
      nextBillingAt: computeNextBilling(base, plan.billingInterval),
      provider: "asaas",
      paidAt: startAt,
    },
  });

  await upsertPaidPayment({
    parsed,
    // Valor REALMENTE cobrado nesta renovação — já foi conferido contra o
    // conjunto de valores legítimos do plano logo acima. Antes gravava
    // `plan.priceCents`: com a pré-venda ativa, quem pagou R$ 45,90 ficava
    // registrado como R$ 77,00 — um fato financeiro falso no ledger local,
    // que é justamente onde a receita é conferida.
    amountCents: parsed.amountCents,
    userId: user.id,
    planId: plan.id,
    subscriptionId: sub.id,
    startAt,
  });

  await upsertChargeGrant({
    parsed,
    order: null,
    planName: plan.name,
    planId: plan.id,
    buyer: { userId: user.id, email: user.email },
    startAt: base,
    expiresAt: newExpiry,
  });

  return "applied";
}

// ---------------------------------------------------------------
// Ciclo de vida (não-pagamento) — ordem correspondente
// ---------------------------------------------------------------

async function applyOrderLifecycle(
  parsed: ParsedAsaasEvent,
  order: CheckoutOrder
): Promise<ApplyOutcome> {
  switch (parsed.event) {
    case "PAYMENT_CANCELED": {
      if (order.status === "PAID") return "noop"; // pago não é desfeito aqui
      await bll.checkoutOrder.update({
        where: { id: order.id },
        data: {
          status: "CANCELED",
          audit: { step: "payment_canceled", at: new Date().toISOString() },
        },
      });
      return "applied";
    }

    case "PAYMENT_REFUNDED": {
      if (order.status !== "PAID") return "noop";
      await revokeAccessForRefund(order, parsed);
      await bll.checkoutOrder.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          audit: { step: "payment_refunded", at: new Date().toISOString() },
        },
      });
      return "applied";
    }

    case "PAYMENT_OVERDUE": {
      // Não revoga período já pago. A subscription recorrente pode ficar
      // PAST_DUE se vinculada a User.
      const sub = await findSubscriptionByExternalId(
        order.externalSubscriptionId ?? null,
        order.externalPaymentId ?? null
      );
      if (sub && order.userId) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" },
        });
        return "applied";
      }
      return "noop";
    }

    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_UPDATED": {
      if (parsed.externalSubscriptionId) {
        await bll.checkoutOrder.update({
          where: { id: order.id },
          data: {
            externalSubscriptionId: parsed.externalSubscriptionId,
            audit: { step: "subscription_linked", at: new Date().toISOString() },
          },
        });
        return "applied";
      }
      return "noop";
    }

    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED": {
      // Cancela renovação futura SEM apagar período já pago (regra 20).
      const sub = await findSubscriptionByExternalId(
        order.externalSubscriptionId ?? null,
        order.externalPaymentId ?? null
      );
      if (sub) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { autoRenew: false, canceledAt: new Date() },
        });
        return "applied";
      }
      return "noop";
    }

    case "CHECKOUT_PAID": {
      // CONCLUSÃO DO CHECKOUT ≠ PAGAMENTO CONFIRMADO.
      // A liberação de acesso vem de PAYMENT_CONFIRMED / PAYMENT_RECEIVED —
      // este evento NÃO libera nada e NÃO marca a ordem como paga (isso
      // liberaria duas vezes). Aqui só reconciliamos o STATUS do CheckoutOrder
      // (registro de auditoria de que o checkout foi concluído).
      if (order.status === "PAID") return "noop"; // já confirmado pelo pagamento
      await bll.checkoutOrder.update({
        where: { id: order.id },
        data: {
          audit: {
            step: "checkout_paid",
            at: new Date().toISOString(),
            note: "Checkout concluído no Asaas — acesso ainda não liberado (aguarda pagamento confirmado).",
            eventId: parsed.eventId,
          },
        },
      });
      return "applied";
    }

    default:
      return "noop";
  }
}

// ---------------------------------------------------------------
// Ciclo de vida sem ordem correspondente
// ---------------------------------------------------------------

async function applySubscriptionLifecycleOnly(
  parsed: ParsedAsaasEvent
): Promise<ApplyOutcome> {
  const sub = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? null,
    parsed.externalPaymentId ?? null
  );
  if (!sub) return "noop";

  switch (parsed.event) {
    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED":
      await bll.subscription.update({
        where: { id: sub.id },
        data: { autoRenew: false, canceledAt: new Date() },
      });
      return "applied";
    case "PAYMENT_OVERDUE":
      await bll.subscription.update({
        where: { id: sub.id },
        data: { status: "PAST_DUE" },
      });
      return "applied";
    default:
      return "noop";
  }
}

// ---------------------------------------------------------------
// Comprador
// ---------------------------------------------------------------

interface Buyer {
  userId: string | null;
  email: string;
  userExists: boolean;
}

async function resolveOrCreateBuyer(order: CheckoutOrder): Promise<Buyer> {
  const email = normalizeEmail(order.email) ?? order.email;
  if (order.userId) {
    return { userId: order.userId, email, userExists: true };
  }
  const user = (await bll.user.findUnique({
    where: { email },
    select: { id: true },
  })) as unknown as { id: string } | null;
  return { userId: user?.id ?? null, email, userExists: Boolean(user) };
}

// ---------------------------------------------------------------
// Subscription (User existente)
// ---------------------------------------------------------------

async function upsertActiveSubscriptionForCharge(input: {
  parsed: ParsedAsaasEvent;
  order: CheckoutOrder;
  plan: { id: string; type: string; billingInterval: string | null; durationDays: number | null };
  buyerUserId: string;
  startAt: Date;
  expiresAt: Date | null;
}): Promise<{ id: string } | null> {
  const { parsed, order, plan, buyerUserId, startAt, expiresAt } = input;
  const planDuration = planDurationFor(plan);

  const existing = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? order.externalSubscriptionId ?? null,
    order.externalPaymentId ?? null
  );

  if (existing) {
    const base =
      existing.expiresAt && existing.expiresAt.getTime() > startAt.getTime()
        ? existing.expiresAt
        : startAt;
    const newExpiry =
      planDuration === null
        ? null
        : new Date(base.getTime() + planDuration * DAY_MS);
    await bll.subscription.update({
      where: { id: existing.id },
      data: {
        userId: buyerUserId,
        planId: plan.id,
        status: "ACTIVE",
        billingType: order.billingType,
        billingInterval: plan.billingInterval,
        startAt: base,
        expiresAt: newExpiry,
        autoRenew: plan.type === "RECURRING",
        nextBillingAt: computeNextBilling(base, plan.billingInterval),
        provider: "asaas",
        externalPaymentId: parsed.externalPaymentId ?? existing.externalPaymentId,
        externalSubscriptionId:
          parsed.externalSubscriptionId ?? existing.externalSubscriptionId,
        amountCents: order.expectedAmountCents,
        currency: "BRL",
        paidAt: startAt,
        accessSource: "ASAAS",
      },
    });
    return { id: existing.id };
  }

  const created = (await bll.subscription.create({
    data: {
      userId: buyerUserId,
      planId: plan.id,
      status: "ACTIVE",
      billingType: order.billingType,
      billingInterval: plan.billingInterval,
      startAt,
      expiresAt,
      autoRenew: plan.type === "RECURRING",
      nextBillingAt: computeNextBilling(startAt, plan.billingInterval),
      provider: "asaas",
      externalPaymentId: parsed.externalPaymentId ?? order.externalPaymentId,
      externalSubscriptionId:
        parsed.externalSubscriptionId ?? order.externalSubscriptionId,
      amountCents: order.expectedAmountCents,
      currency: "BRL",
      paidAt: startAt,
      accessSource: "ASAAS",
    },
  })) as unknown as { id: string };
  return created;
}

/** Reutiliza durationDays do plano (sem fallback arbitrário). */
function planDurationFor(plan: { durationDays?: number | null }): number | null {
  return plan.durationDays && plan.durationDays > 0 ? plan.durationDays : null;
}

// ---------------------------------------------------------------
// Payment
// ---------------------------------------------------------------

async function upsertPaidPayment(input: {
  parsed: ParsedAsaasEvent;
  amountCents: number;
  userId: string | null;
  planId: string;
  subscriptionId: string | null;
  startAt: Date;
}): Promise<void> {
  // Payment.userId é FK obrigatória → comprador SEM conta não gera Payment
  // (o AccessGrant + CheckoutOrder são os registros da compra anônima).
  if (!input.userId || !input.parsed.externalPaymentId) return;

  const existing = (await bll.payment.findFirst({
    where: { externalPaymentId: input.parsed.externalPaymentId },
  })) as unknown as { id: string } | null;

  const data = {
    userId: input.userId,
    planId: input.planId,
    subscriptionId: input.subscriptionId,
    amountCents: input.amountCents, // regra 15: valor validado, nunca 0
    currency: "BRL",
    status: "PAID",
    provider: "asaas",
    externalPaymentId: input.parsed.externalPaymentId,
    paidAt: input.startAt,
    eventType: input.parsed.event,
    eventId: input.parsed.eventId,
  };

  if (existing) {
    await bll.payment.update({ where: { id: existing.id }, data });
  } else {
    try {
      await bll.payment.create({ data });
    } catch {
      /* Payment.eventId @@unique — um concorrente pode ter criado; segue */
    }
  }
}

// ---------------------------------------------------------------
// AccessGrant (por cobrança)
// ---------------------------------------------------------------

async function upsertChargeGrant(input: {
  parsed: ParsedAsaasEvent;
  order: CheckoutOrder | null;
  planId: string;
  planName: string;
  buyer: { userId: string | null; email: string };
  startAt: Date;
  expiresAt: Date | null;
}): Promise<boolean> {
  const { parsed, order, planId, planName, buyer, startAt, expiresAt } = input;
  if (!parsed.externalPaymentId) return false;
  const email = buyer.email;

  const existing = (await bll.accessGrant.findFirst({
    where: {
      email,
      origin: "ASAAS",
      externalPaymentId: parsed.externalPaymentId,
    },
  })) as unknown as { id: string } | null;

  const data = {
    userId: buyer.userId ?? null,
    planId,
    planName,
    origin: "ASAAS",
    // Comprador sem conta ainda precisa provar posse do e-mail + criar senha.
    status: buyer.userId ? "ACTIVE" : "PENDING_FIRST_ACCESS",
    startAt,
    expiresAt,
    externalPaymentId: parsed.externalPaymentId,
    externalSubscriptionId:
      parsed.externalSubscriptionId ?? order?.externalSubscriptionId ?? null,
    firstAccessCompleted: buyer.userId ? true : false,
    firstAccessCompletedAt: buyer.userId ? new Date() : null,
    grantedByAdminId: null,
  };

  if (existing) {
    await bll.accessGrant.update({ where: { id: existing.id }, data });
    // Replay/atualização de grant já existente → NÃO reenvia e-mail.
    return false;
  }

  try {
    await bll.accessGrant.create({ data: { ...data, email } });
  } catch {
    // @@unique([email, origin, externalPaymentId]) — concorrência: outra
    // entrega do mesmo evento venceu. NÃO reenvia (evita e-mail duplicado).
    return false;
  }

  // Aviso de "acesso liberado" para comprador SEM conta (regra: o redirect do
  // checkout NÃO prova pagamento; quem garante a liberação é este webhook
  // validado). Best-effort e nunca bloqueia: falha de e-mail não pode derrubar
  // o processamento do webhook nem impedir a liberação já concedida. Só é
  // disparado na CRIAÇÃO de um grant novo (nunca em replay/atualização).
  if (!buyer.userId && email) {
    void sendAccessReleasedEmail({
      to: email,
      planName,
      appUrl: `${getAppBaseUrl()}/primeiro-acesso`,
    }).catch(() => {
      /* nunca derruba o fluxo */
    });
  }

  return true;
}

// ---------------------------------------------------------------
// Estorno (regra 19)
// ---------------------------------------------------------------

async function revokeAccessForRefund(
  order: CheckoutOrder,
  parsed: ParsedAsaasEvent
): Promise<void> {
  const email = normalizeEmail(order.email) ?? order.email;
  const paymentId = parsed.externalPaymentId ?? order.externalPaymentId;

  // Revoga a Subscription vinculada a ESTA cobrança (interrompe renovação).
  const sub = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? order.externalSubscriptionId ?? null,
    order.externalPaymentId ?? null
  );
  if (sub) {
    await bll.subscription.update({
      where: { id: sub.id },
      data: { status: "CANCELED", canceledAt: new Date(), autoRenew: false },
    });
  }

  // Revoga SOMENTE o grant desta cobrança. Períodos pagos por outras cobranças
  // (outros grants) permanecem — regra 20.
  if (paymentId) {
    const grant = (await bll.accessGrant.findFirst({
      where: { email, origin: "ASAAS", externalPaymentId: paymentId },
    })) as unknown as { id: string } | null;
    if (grant) {
      await bll.accessGrant.update({
        where: { id: grant.id },
        data: { status: "CANCELED", expiresAt: new Date() },
      });
    }
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function computeNextBilling(from: Date, interval: string | null): Date | null {
  if (!interval) return null;
  const d = new Date(from.getTime());
  if (interval === "MONTH") d.setMonth(d.getMonth() + 1);
  else if (interval === "YEAR") d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d;
}

async function resolveOwner(
  parsed: ParsedAsaasEvent
): Promise<{ userId: string | null; subscriptionId: string | null }> {
  const sub = await findSubscriptionByExternalId(
    parsed.externalSubscriptionId ?? null,
    parsed.externalPaymentId ?? null
  );
  if (sub) return { userId: sub.userId, subscriptionId: sub.id };

  const raw = parsed.raw as { payment?: { customer?: unknown } | null };
  const customer = raw.payment?.customer;
  if (typeof customer === "string") {
    const user = (await bll.user.findUnique({
      where: { asaasCustomerId: customer },
      select: { id: true },
    })) as unknown as { id: string } | null;
    if (user) return { userId: user.id, subscriptionId: null };
  }
  return { userId: null, subscriptionId: null };
}
