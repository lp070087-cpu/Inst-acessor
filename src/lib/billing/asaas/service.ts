import { randomUUID } from "crypto";

import { bll } from "@/lib/billing/db";
import { getPlanById, type PlanView } from "@/lib/billing/plans";
import { asaasClient } from "./client";
import { getAsaasConfig } from "./config";
import type {
  AsaasCustomer,
  AsaasPayment,
  AsaasPaymentCreated,
  AsaasSubscription,
  AsaasSubscriptionCreated,
} from "./types";

/**
 * ASAAS — SERVIÇO DE NEGÓCIO (server-only)
 * =========================================
 * Fluxo real de checkout do Inst Acessor:
 *
 *   1. Resolve o plano SEMPRE no servidor (`getPlanById`) — o client envia
 *      apenas `planId`; NUNCA preço/duração vindos do browser.
 *   2. Garante o customer Asaas (busca pelo `User.asaasCustomerId`; cria se
 *      ausente) — evita duplicar customer por usuário.
 *   3. Cria a cobrança (ONE_TIME) ou assinatura (RECURRING) no Asaas.
 *   4. Persiste localmente uma Subscription em PENDING (checkout criado ≠
 *      pagamento aprovado) com os IDs externos e preço travado.
 *
 * NENHUMA chamada é feita quando `ASAAS_API_KEY` está ausente — os métodos
 * retornam `INTEGRATION_NOT_CONFIGURED` (fail-closed).
 */

export interface AsaasCheckoutData {
  ok: boolean;
  status: "CONFIGURED" | "INTEGRATION_NOT_CONFIGURED";
  checkoutUrl: string | null;
  message: string;
  subscriptionId: string | null;
  planId: string | null;
  planName: string | null;
  priceCents: number | null;
  /** Estado local da assinatura (NUNCA "ACTIVE" sem confirmação real). */
  subscriptionStatus: string | null;
}

/** Resolve o plano no servidor — a ÚNICA fonte de preço/duração/ciclo. */
export async function resolvePlanServerSide(planId: string): Promise<PlanView | null> {
  return getPlanById(planId);
}

/**
 * Garante (busca ou cria) o customer Asaas do usuário.
 * Persiste APENAS o ID externo (`User.asaasCustomerId`) — nunca a API key.
 * Assocía o customer ao usuário correto via `userId` da sessão.
 */
export async function ensureAsaasCustomer(input: {
  userId: string;
  email: string;
  name: string | null;
}): Promise<string> {
  const user = (await bll.user.findUnique({
    where: { id: input.userId },
  })) as unknown as { id: string; email: string; name: string | null; asaasCustomerId: string | null } | null;

  if (user?.asaasCustomerId) return user.asaasCustomerId;

  const cfg = getAsaasConfig();
  const customerName = (input.name ?? input.email.split("@")[0] ?? "Cliente Inst Acessor").slice(0, 100);
  const customer: AsaasCustomer = await asaasClient.post<AsaasCustomer>("/customers", {
    name: customerName,
    email: input.email,
  }, cfg);

  await bll.user.update({
    where: { id: input.userId },
    data: { asaasCustomerId: customer.id },
  });

  return customer.id;
}

function computeExpiresAt(start: Date, plan: PlanView): Date {
  const days = plan.durationDays && plan.durationDays > 0 ? plan.durationDays : 7;
  return new Date(start.getTime() + days * 86_400_000);
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
 * Inicia o checkout real no Asaas.
 * - ONE_TIME → POST /payments (cobrança avulsa).
 * - RECURRING → POST /subscriptions (assinatura mensal/anual).
 *
 * CRIAÇÃO DE CHECKOUT ≠ PAGAMENTO APROVADO: a Subscription é persistida em
 * PENDING; `startAt`/`paidAt`/`expiresAt` só são preenchidos pelo webhook
 * quando o pagamento for confirmado.
 */
export async function startAsaasCheckout(input: {
  userId: string;
  userEmail: string;
  userName: string | null;
  planId: string;
}): Promise<AsaasCheckoutData> {
  const cfg = getAsaasConfig();
  if (!cfg.apiKey) {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      checkoutUrl: null,
      message: "Pagamento online em configuração.",
      subscriptionId: null,
      planId: input.planId,
      planName: null,
      priceCents: null,
      subscriptionStatus: null,
    };
  }

  // 1) Plano SEMPRE resolvido no servidor.
  const plan = await resolvePlanServerSide(input.planId);
  if (!plan || !plan.active) {
    return {
      ok: false,
      status: "CONFIGURED",
      checkoutUrl: null,
      message: "Plano não encontrado.",
      subscriptionId: null,
      planId: input.planId,
      planName: null,
      priceCents: null,
      subscriptionStatus: null,
    };
  }

  // 2) Customer Asaas (sem duplicar).
  const customerId = await ensureAsaasCustomer({
    userId: input.userId,
    email: input.userEmail,
    name: input.userName,
  });

  // 3) Cria cobrança/assinatura no Asaas.
  const externalReference = `instacessor:${input.userId}:${plan.slug}`;
  const billingType = cfg.billingType;
  const value = plan.priceCents / 100; // Asaas espera valor em Reais (float).
  const now = new Date();

  let externalPaymentId: string | null = null;
  let externalSubscriptionId: string | null = null;
  let checkoutUrl: string | null = null;

  if (plan.type === "ONE_TIME") {
    const payment = await asaasClient.post<AsaasPaymentCreated>("/payments", {
      customer: customerId,
      billingType,
      value,
      dueDate: now.toISOString().slice(0, 10),
      description: `Inst Acessor — Plano ${plan.name} (7 dias)`,
      externalReference,
    }, cfg);
    externalPaymentId = payment.id;
    checkoutUrl = payment.invoiceUrl ?? payment.bankSlipUrl ?? payment.pixQrCodeUrl ?? payment.pixCopiaECola ?? null;
  } else {
    const subscription = await asaasClient.post<AsaasSubscriptionCreated>("/subscriptions", {
      customer: customerId,
      billingType,
      value,
      nextDueDate: now.toISOString().slice(0, 10),
      cycle: plan.billingInterval === "YEAR" ? "YEARLY" : "MONTHLY",
      description: `Inst Acessor — Plano ${plan.name}`,
      externalReference,
    }, cfg);
    externalSubscriptionId = subscription.id;
    checkoutUrl = null; // assinatura não tem URL de checkout única; pagamento vem por boleto/PIX na 1ª cobrança.
  }

  // 4) Persiste localmente em PENDING (checkout ≠ aprovado).
  const idempotencyKey = `asaas:checkout:${input.userId}:${plan.slug}:${randomUUID()}`;
  const expiresAt = computeExpiresAt(now, plan);

  const created = (await bll.subscription.create({
    data: {
      userId: input.userId,
      planId: plan.id,
      status: "PENDING",
      billingType: plan.type,
      billingInterval: plan.billingInterval,
      startAt: null,
      expiresAt: plan.type === "RECURRING" ? null : expiresAt,
      autoRenew: plan.type === "RECURRING",
      nextBillingAt: plan.type === "RECURRING" ? computeNextBilling(now, plan.billingInterval) : null,
      canceledAt: null,
      provider: "asaas",
      externalCustomerId: customerId,
      externalSubscriptionId,
      externalPaymentId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      paidAt: null,
      idempotencyKey,
    },
  })) as unknown as { id: string };

  return {
    ok: true,
    status: "CONFIGURED",
    checkoutUrl,
    message: "Checkout iniciado. O acesso é liberado somente após a confirmação do pagamento.",
    subscriptionId: created.id,
    planId: plan.id,
    planName: plan.name,
    priceCents: plan.priceCents,
    subscriptionStatus: "PENDING",
  };
}

/**
 * Cancela a assinatura no Asaas (fim do vínculo recorrente).
 * Só aceita subscriptions locais do próprio usuário (owner-check).
 */
export async function cancelAsaasSubscription(input: {
  userId: string;
  subscriptionId: string;
}): Promise<{ ok: boolean; message: string }> {
  const cfg = getAsaasConfig();
  if (!cfg.apiKey) {
    return { ok: false, message: "Pagamento online em configuração." };
  }

  const existing = (await bll.subscription.findUnique({
    where: { id: input.subscriptionId },
  })) as unknown as { userId: string; externalSubscriptionId: string | null } | null;

  if (!existing || existing.userId !== input.userId) {
    return { ok: false, message: "Assinatura não encontrada." };
  }
  if (!existing.externalSubscriptionId) {
    return { ok: false, message: "Assinatura sem vínculo externo." };
  }

  try {
    await asaasClient.del<unknown>(
      `/subscriptions/${existing.externalSubscriptionId}`,
      cfg
    );
    return { ok: true, message: "Assinatura cancelada no Asaas." };
  } catch {
    return { ok: false, message: "Não foi possível cancelar a assinatura no Asaas." };
  }
}

export type { AsaasPayment, AsaasSubscription };
