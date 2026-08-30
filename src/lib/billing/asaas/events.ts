import { bll } from "@/lib/billing/db";
import type { ParsedAsaasEvent } from "./webhook";
import { sanitizeAsaasPayload } from "./client";

/**
 * ASAAS — PROCESSADOR DE EVENTOS (webhook)
 * =========================================
 * Aplica um evento confirmado do Asaas nos registros locais.
 *
 * Regras:
 *   - NUNCA confia em `userId` do payload — o dono é localizado pela
 *     referência externa (customer/subscription/payment id).
 *   - Idempotente por "claim-first": o `BillingEvent` é criado ANTES de
 *     aplicar o efeito. Se a criação falhar por `eventId` duplicado
 *     (concorrência/replay), retorna `duplicate` sem reprocessar.
 *   - Atualiza SOMENTE registros correspondentes (external*Id match).
 *   - Sanitiza o payload antes de persistir.
 *   - CRIAR CHECKOUT ≠ PAGAMENTO APROVADO: `ACTIVE` só é marcado quando o
 *     evento de pagamento confirmado chega.
 */

/** Aplica o evento; retorna `duplicate` se já foi processado/em processo. */
export async function handleAsaasEvent(
  parsed: ParsedAsaasEvent
): Promise<{ duplicate: boolean }> {
  // 1) CLAIM: registra o evento (processed:false) ANTES de aplicar.
  //    Se outro processamento concorrente/replay já criou o mesmo eventId,
  //    o unique constraint falha → duplicate (nada é aplicado duas vezes).
  let claim: { id: string };
  try {
    claim = (await bll.billingEvent.create({
      data: {
        eventId: parsed.eventId,
        provider: "asaas",
        type: parsed.event,
        userId: null, // preenchido após localizar o dono
        subscriptionId: null,
        payload: sanitizeAsaasPayload(parsed.raw),
        processed: false,
      },
    })) as unknown as { id: string };
  } catch {
    return { duplicate: true };
  }

  // 2) Localiza o dono pela referência externa (nunca pelo payload).
  let owner: { userId: string | null; subscriptionId: string | null } | null = null;
  try {
    owner = await resolveOwnerByExternalRef(parsed);

    // 3) Aplica o evento nos registros correspondentes.
    await applyEvent(parsed, owner?.userId ?? null);
  } catch (err) {
    // Aplica com falha: mantém processed:false para auditoria/retry manual.
    // O webhook ainda responde rápido (200) — o Asaas não fica reenviando.
    console.error("[asaas-events] falha ao aplicar evento", parsed.event, err);
  }

  // 4) Marca como processado (payload sanitizado já persistido no claim).
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
    console.error("[asaas-events] falha ao finalizar registro do evento", err);
  }

  return { duplicate: false };
}

/** Localiza o registro local pela referência externa do evento. */
async function resolveOwnerByExternalRef(parsed: ParsedAsaasEvent): Promise<{
  userId: string | null;
  subscriptionId: string | null;
} | null> {
  // Assinatura/cobrança — pela subscription/payment id.
  if (parsed.externalSubscriptionId || parsed.externalPaymentId) {
    const sub = (await bll.subscription.findFirst({
      where: {
        OR: [
          { externalSubscriptionId: parsed.externalSubscriptionId ?? "__none__" },
          { externalPaymentId: parsed.externalPaymentId ?? "__none__" },
        ],
      },
      select: { id: true, userId: true },
    })) as unknown as { id: string; userId: string } | null;
    if (sub) return { userId: sub.userId, subscriptionId: sub.id };
  }

  // Customer — pela referência do customer (fallback seguro).
  if (parsed.externalCustomerId) {
    const user = (await bll.user.findUnique({
      where: { asaasCustomerId: parsed.externalCustomerId },
      select: { id: true },
    })) as unknown as { id: string } | null;
    if (user) return { userId: user.id, subscriptionId: null };
  }

  return null;
}

/** Aplica o evento nos registros correspondentes (owner-checked). */
async function applyEvent(
  parsed: ParsedAsaasEvent,
  userId: string | null
): Promise<void> {
  if (!userId) return;

  switch (parsed.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      // Pagamento confirmado → libera acesso (se houver subscription/plano).
      if (parsed.externalSubscriptionId || parsed.externalPaymentId) {
        const sub = (await bll.subscription.findFirst({
          where: {
            userId,
            OR: [
              { externalSubscriptionId: parsed.externalSubscriptionId ?? "__none__" },
              { externalPaymentId: parsed.externalPaymentId ?? "__none__" },
            ],
          },
        })) as unknown as {
          id: string;
          planId: string;
          billingInterval: string | null;
        } | null;

        if (sub) {
          const plan = (await bll.plan.findUnique({
            where: { id: sub.planId },
          })) as unknown as { durationDays: number | null; billingInterval: string | null } | null;

          const startAt = parsed.paidAt ? new Date(parsed.paidAt) : new Date();
          const durationDays =
            plan?.durationDays && plan.durationDays > 0 ? plan.durationDays : 7;
          const expiresAt = new Date(startAt.getTime() + durationDays * 86_400_000);

          await bll.subscription.update({
            where: { id: sub.id },
            data: {
              status: "ACTIVE",
              startAt,
              expiresAt,
              paidAt: startAt,
              nextBillingAt: computeNextBilling(
                startAt,
                plan?.billingInterval ?? sub.billingInterval
              ),
            },
          });

          // Registra o pagamento confirmado.
          await upsertPaidPayment(parsed, sub.id, userId, sub.planId);

          // Primeiro Acesso: registra/atualiza o AccessGrant (origem ASAAS)
          // para o e-mail do usuário. O acesso real é liberado; o cliente
          // ainda precisa concluir o primeiro acesso (prova de posse + senha).
          await upsertAsaasAccessGrant({
            userId,
            subId: sub.id,
            planId: sub.planId,
            startAt,
            expiresAt,
            externalPaymentId: parsed.externalPaymentId,
            externalSubscriptionId: parsed.externalSubscriptionId,
          });
        }
      }
      break;
    }

    case "PAYMENT_OVERDUE": {
      // Vencimento → marca a assinatura como PAST_DUE (sem bloquear acesso atual).
      const sub = await findSubscription(parsed, userId);
      if (sub) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }

    case "PAYMENT_CANCELED": {
      // Cobrança cancelada → assinatura volta a PENDING se nunca foi paga.
      const sub = await findSubscription(parsed, userId);
      if (sub) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { status: "PENDING" },
        });
      }
      break;
    }

    case "PAYMENT_REFUNDED": {
      // Estorno → revoga acesso (expira imediatamente).
      const sub = await findSubscription(parsed, userId);
      if (sub) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { status: "CANCELED", canceledAt: new Date(), expiresAt: new Date() },
        });
      }
      break;
    }

    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_UPDATED": {
      // Atualiza dados da assinatura (vínculo externo) se correspondente.
      const sub = await findSubscription(parsed, userId);
      if (sub && parsed.externalSubscriptionId) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { externalSubscriptionId: parsed.externalSubscriptionId },
        });
      }
      break;
    }

    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED": {
      // Assinatura inativada/excluída → não renova mais.
      const sub = await findSubscription(parsed, userId);
      if (sub) {
        await bll.subscription.update({
          where: { id: sub.id },
          data: { autoRenew: false, canceledAt: new Date() },
        });
      }
      break;
    }

    default:
      // Eventos não mapeados são apenas registrados (idempotentes).
      break;
  }
}

/** Busca a assinatura local correspondente ao evento (owner-check). */
async function findSubscription(
  parsed: ParsedAsaasEvent,
  userId: string
): Promise<{ id: string } | null> {
  const or: Array<Record<string, string>> = [];
  if (parsed.externalSubscriptionId) {
    or.push({ externalSubscriptionId: parsed.externalSubscriptionId });
  }
  if (parsed.externalPaymentId) {
    or.push({ externalPaymentId: parsed.externalPaymentId });
  }
  if (or.length === 0) return null;

  return (await bll.subscription.findFirst({
    where: { userId, OR: or },
  })) as unknown as { id: string } | null;
}

/**
 * Registra (ou atualiza) o Payment PAID correspondente ao evento.
 * `externalPaymentId` NÃO é único no schema (é índice) → usa findFirst.
 */
async function upsertPaidPayment(
  parsed: ParsedAsaasEvent,
  subscriptionId: string,
  userId: string,
  planId: string
): Promise<void> {
  if (!parsed.externalPaymentId) return;

  const existing = (await bll.payment.findFirst({
    where: { externalPaymentId: parsed.externalPaymentId },
  })) as unknown as { id: string } | null;

  const data = {
    userId,
    subscriptionId,
    planId,
    amountCents: parsed.amountCents ?? 0,
    currency: "BRL",
    status: "PAID",
    provider: "asaas",
    externalPaymentId: parsed.externalPaymentId,
    paidAt: parsed.paidAt ? new Date(parsed.paidAt) : new Date(),
    eventType: parsed.event,
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
 * PRIMEIRO ACESSO — registra/atualiza o AccessGrant de origem ASAAS.
 * Cria se não existir (upsert por e-mail + origem + externalPaymentId),
 * atualiza período/status quando houver renovação. NUNCA inventa externalId.
 */
async function upsertAsaasAccessGrant(input: {
  userId: string;
  subId: string;
  planId: string;
  startAt: Date;
  expiresAt: Date;
  externalPaymentId: string | null;
  externalSubscriptionId: string | null;
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

    const plan = (await bll.plan.findUnique({
      where: { id: input.planId },
      select: { name: true },
    })) as unknown as { name: string } | null;

    // Se o usuário ainda NÃO concluiu o primeiro acesso → status PENDING_FIRST_ACCESS
    // (o cliente precisa provar posse + criar senha). Se já concluiu, fica ACTIVE.
    const status = user.firstAccessCompleted ? "ACTIVE" : "PENDING_FIRST_ACCESS";

    const existing = (await bll.accessGrant?.findFirst?.({
      where: {
        email: user.email,
        origin: "ASAAS",
        externalPaymentId: input.externalPaymentId ?? "__none__",
      },
    })) as unknown as { id: string } | null;

    const data = {
      userId: input.userId,
      planId: input.planId,
      planName: plan?.name ?? null,
      origin: "ASAAS",
      status,
      startAt: input.startAt,
      expiresAt: input.expiresAt,
      externalPaymentId: input.externalPaymentId,
      externalSubscriptionId: input.externalSubscriptionId,
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
    console.error("[asaas-events] falha ao registrar AccessGrant", err);
  }
}
