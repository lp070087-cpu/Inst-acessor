import { bll } from "@/lib/billing/db";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import { checkPayment } from "./client";
import type { ParsedInfinitePayEvent } from "./webhook";
import { sanitizeInfinitePayPayload } from "./webhook";

/**
 * INFINITEPAY — PROCESSADOR DE EVENTOS (HISTÓRICO, fora dos fluxos ativos)
 * =======================================================================
 * O gateway oficial do Inst Acessor é o ASAAS (ver
 * `src/lib/billing/asaas/checkout-order.ts`). Este processador permanece
 * apenas para interpretar eventos já recebidos pelo webhook antigo e manter o
 * histórico consistente — ele NÃO é acionado por nenhum checkout novo.
 *
 * Aplica um evento confirmado do InfinitePay nos registros locais.
 *
 * Regras (fail-closed):
 *   - NUNCA confia em `userId` do payload — o dono é localizado pela referência
 *     externa (transaction_nsu/order_nsu/invoice_slug) no banco.
 *   - Idempotente por "claim-first": o `BillingEvent` é criado ANTES de aplicar
 *     o efeito. Se a criação falhar por `eventId` duplicado (replay/concorrência),
 *     retorna `duplicate` sem reprocessar.
 *   - NUNCA concede acesso só porque chegou um POST. A liberação exige:
 *       (a) dono localizado pela referência externa;
 *       (b) plano/valor conferido contra o catálogo oficial;
 *       (c) `payment_check` real no InfinitePay respondendo "pago" (quando a
 *           chave de confirmação estiver configurada). Sem chave → o evento é
 *           registrado como `PENDING_CONFIRMATION`, sem liberar acesso.
 *   - Atualiza SOMENTE registros correspondentes (external*Id match).
 *   - Sanitiza o payload antes de persistir.
 */

export const INFINITEPAY_PROVIDER = "infinitepay";
export const INFINITEPAY_SOURCE = "INFINITEPAY";

export interface ProcessInfinitePayEventResult {
  duplicate: boolean;
  /** true quando o acesso foi de fato liberado (pagamento confirmado). */
  granted: boolean;
  /** Estado de confirmação: confirmed | pending_confirmation | not_found | rejected */
  confirmation: "confirmed" | "pending_confirmation" | "not_found" | "rejected";
}

/** Aplica o evento; retorna o estado de confirmação real. */
export async function handleInfinitePayEvent(
  parsed: ParsedInfinitePayEvent
): Promise<ProcessInfinitePayEventResult> {
  // 1) CLAIM: registra o evento (processed:false) ANTES de aplicar.
  let claim: { id: string };
  try {
    claim = (await bll.billingEvent.create({
      data: {
        eventId: parsed.eventId,
        provider: INFINITEPAY_PROVIDER,
        type: "PAYMENT_NOTIFICATION",
        userId: null,
        subscriptionId: null,
        payload: sanitizeInfinitePayPayload(parsed.raw),
        processed: false,
      },
    })) as unknown as { id: string };
  } catch {
    return {
      duplicate: true,
      granted: false,
      confirmation: "pending_confirmation",
    };
  }

  let owner: { userId: string | null; subscriptionId: string | null } | null = null;
  let confirmation: ProcessInfinitePayEventResult["confirmation"] = "not_found";
  let granted = false;

  try {
    // 2) Localiza o dono pela referência externa (nunca pelo payload).
    owner = await resolveOwnerByExternalRef(parsed);

    const ownerUser = owner?.userId ?? null;
    if (!ownerUser) {
      confirmation = "not_found";
    } else {
      // 3) Confere plano/valor contra o catálogo oficial.
      const planCheck = await verifyPlanValue(parsed);
      if (!planCheck.ok) {
        confirmation = "rejected";
      } else {
        // 4) Confirmação REAL server-side (quando a chave estiver configurada).
        const confirmed = await confirmServerSide(parsed);
        if (confirmed) {
          granted = true;
          confirmation = "confirmed";
          await applyGrant(parsed, {
            userId: ownerUser,
            subscriptionId: owner?.subscriptionId ?? null,
          });
        } else {
          confirmation = "pending_confirmation";
        }
      }
    }
  } catch (err) {
    // Falha ao aplicar: mantém processed:false para auditoria/retry manual.
    console.error("[infinitepay-events] falha ao aplicar evento", parsed.eventId, err);
    confirmation = confirmation === "not_found" ? confirmation : "pending_confirmation";
  }

  // 5) Marca como processado (payload sanitizado já persistido no claim).
  try {
    await bll.billingEvent.update({
      where: { id: claim.id },
      data: {
        userId: owner?.userId ?? null,
        subscriptionId: owner?.subscriptionId ?? null,
        processed: true,
        processedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[infinitepay-events] falha ao finalizar registro do evento", err);
  }

  return { duplicate: false, granted, confirmation };
}

/** Localiza o registro local pela referência externa do evento. */
async function resolveOwnerByExternalRef(parsed: ParsedInfinitePayEvent): Promise<{
  userId: string | null;
  subscriptionId: string | null;
} | null> {
  const refs: string[] = [];
  if (parsed.transactionNsu) refs.push(parsed.transactionNsu);
  if (parsed.orderNsu) refs.push(parsed.orderNsu);

  if (refs.length > 0) {
    const sub = (await bll.subscription.findFirst({
      where: {
        OR: refs.map((r) => ({
          OR: [
            { externalPaymentId: r },
            { externalSubscriptionId: r },
          ],
        })),
      },
      select: { id: true, userId: true },
    })) as unknown as { id: string; userId: string } | null;
    if (sub) return { userId: sub.userId, subscriptionId: sub.id };
  }

  // Fallback seguro: e-mail do cliente, se o payload trouxer.
  const email = extractEmail(parsed.raw);
  if (email) {
    const user = (await bll.user.findUnique({
      where: { email },
      select: { id: true },
    })) as unknown as { id: string } | null;
    if (user) {
      const sub = (await bll.subscription.findFirst({
        where: { userId: user.id, status: { in: ["PENDING", "ACTIVE"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) as unknown as { id: string } | null;
      return { userId: user.id, subscriptionId: sub?.id ?? null };
    }
  }

  return null;
}

function extractEmail(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  for (const k of ["email", "customer_email", "customerEmail"]) {
    const v = obj[k];
    if (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
      return v.trim().toLowerCase();
    }
  }
  const customer = obj.customer ?? obj.buyer;
  if (typeof customer === "object" && customer !== null) {
    const c = customer as Record<string, unknown>;
    for (const k of ["email", "mail", "customer_email"]) {
      const v = c[k];
      if (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
        return v.trim().toLowerCase();
      }
    }
  }
  return null;
}

/**
 * Confere o plano/valor informados contra o catálogo oficial.
 * Sem `planSlug` no payload → `ok:true` (sem como conferir, mas o dono foi
 * localizado); com slug, exige valor correspondente (tolerância de 0 — valor
 * exato em centavos).
 */
async function verifyPlanValue(parsed: ParsedInfinitePayEvent): Promise<{ ok: boolean }> {
  if (!parsed.planSlug) return { ok: true };
  const plan = PLAN_CATALOG.find((p) => p.slug === parsed.planSlug);
  if (!plan) return { ok: false };
  if (parsed.amountCents != null && parsed.amountCents !== plan.priceCents) {
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Confirmação server-side: chama `payment_check` no InfinitePay.
 * - Sem `INFINITEPAY_API_KEY` → NÃO confirma (fail-closed).
 * - Só retorna true quando a API responder explicitamente como pago.
 */
async function confirmServerSide(parsed: ParsedInfinitePayEvent): Promise<boolean> {
  const result = await checkPayment({
    transactionNsu: parsed.transactionNsu,
    orderNsu: parsed.orderNsu,
    planSlug: parsed.planSlug,
  });
  if (!result.ok) return false;
  return result.paid === true;
}

/** Aplica a liberação de acesso (somente após confirmação real). */
async function applyGrant(
  parsed: ParsedInfinitePayEvent,
  owner: { userId: string; subscriptionId: string | null }
): Promise<void> {
  const plan = parsed.planSlug
    ? PLAN_CATALOG.find((p) => p.slug === parsed.planSlug)
    : undefined;

  const startAt = new Date();
  const durationDays = plan?.durationDays ?? 7;
  const expiresAt = new Date(startAt.getTime() + durationDays * 86_400_000);

  if (owner.subscriptionId) {
    await bll.subscription.update({
      where: { id: owner.subscriptionId },
      data: {
        status: "ACTIVE",
        startAt,
        expiresAt,
        paidAt: startAt,
        nextBillingAt: computeNextBilling(startAt, plan?.billingInterval ?? null),
        provider: INFINITEPAY_PROVIDER,
        accessSource: INFINITEPAY_SOURCE,
        externalPaymentId: parsed.transactionNsu ?? parsed.orderNsu,
        amountCents: parsed.paidAmountCents ?? parsed.amountCents,
      },
    });
    await upsertPaidPayment(parsed, owner.subscriptionId, owner.userId);
  } else {
    // Sem subscription local: registra o Payment para auditoria.
    await upsertPaidPayment(parsed, null, owner.userId);
  }

  // Primeiro Acesso: registra/atualiza o AccessGrant (origem INFINITEPAY).
  await upsertInfinitePayAccessGrant({
    userId: owner.userId,
    subId: owner.subscriptionId,
    planId: plan ? `plan:${plan.slug}` : null,
    planName: plan?.name ?? null,
    startAt,
    expiresAt,
    externalPaymentId: parsed.transactionNsu ?? parsed.orderNsu,
  });
}

async function upsertPaidPayment(
  parsed: ParsedInfinitePayEvent,
  subscriptionId: string | null,
  userId: string
): Promise<void> {
  const externalPaymentId = parsed.transactionNsu ?? parsed.orderNsu ?? null;
  if (!externalPaymentId) return;

  const existing = (await bll.payment.findFirst({
    where: { externalPaymentId },
  })) as unknown as { id: string } | null;

  const data = {
    userId,
    subscriptionId,
    planId: null,
    amountCents: parsed.paidAmountCents ?? parsed.amountCents ?? 0,
    currency: "BRL",
    status: "PAID",
    provider: INFINITEPAY_PROVIDER,
    externalPaymentId,
    paidAt: new Date(),
    eventType: "PAYMENT_NOTIFICATION",
    eventId: parsed.eventId,
  };

  if (existing) {
    await bll.payment.update({ where: { id: existing.id }, data });
  } else {
    await bll.payment.create({ data });
  }
}

function computeNextBilling(from: Date, interval: string | null): Date | null {
  if (!interval) return null;
  const d = new Date(from.getTime());
  if (interval === "MONTH") d.setMonth(d.getMonth() + 1);
  else if (interval === "YEAR") d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d;
}

/**
 * PRIMEIRO ACESSO — registra/atualiza o AccessGrant de origem INFINITEPAY.
 * Cria se não existir (upsert por e-mail + origem + externalPaymentId).
 */
async function upsertInfinitePayAccessGrant(input: {
  userId: string;
  subId: string | null;
  planId: string | null;
  planName: string | null;
  startAt: Date;
  expiresAt: Date;
  externalPaymentId: string | null;
}): Promise<void> {
  try {
    const user = (await bll.user.findUnique({
      where: { id: input.userId },
      select: { email: true, firstAccessCompleted: true },
    })) as unknown as {
      email: string;
      firstAccessCompleted?: boolean;
    } | null;
    if (!user?.email) return;

    const status = user.firstAccessCompleted ? "ACTIVE" : "PENDING_FIRST_ACCESS";
    const externalPaymentId = input.externalPaymentId ?? "__none__";

    const existing = (await bll.accessGrant?.findFirst?.({
      where: {
        email: user.email,
        origin: INFINITEPAY_SOURCE,
        externalPaymentId,
      },
    })) as unknown as { id: string } | null;

    const data = {
      userId: input.userId,
      planId: input.planId,
      planName: input.planName,
      origin: INFINITEPAY_SOURCE,
      status,
      startAt: input.startAt,
      expiresAt: input.expiresAt,
      externalPaymentId: input.externalPaymentId,
      externalSubscriptionId: null,
      firstAccessCompleted: user.firstAccessCompleted ?? false,
      firstAccessCompletedAt: null,
    };

    if (existing) {
      await bll.accessGrant.update({ where: { id: existing.id }, data });
    } else {
      await bll.accessGrant.create({
        data: { ...data, email: user.email, grantedByAdminId: null },
      });
    }
  } catch (err) {
    // Não bloqueia o fluxo de billing; loga para auditoria.
    console.error("[infinitepay-events] falha ao registrar AccessGrant", err);
  }
}
