import { getBillingAdapter } from "@/lib/billing/provider";
import { getPlanById } from "@/lib/billing/plans";

/**
 * CHECKOUT — LEGADO (Asaas preservado; InfinitePay é o oficial)
 * ==============================================================
 * Fluxo antigo "Escolher plano" via `/api/billing/checkout`.
 * Desde 2026-08-31 o checkout oficial é o InfinitePay (links públicos por
 * plano, conectados diretamente nos cards/CTAs — `plan.checkoutUrl`).
 * Este fluxo é mantido apenas como FALLBACK legado (caso um plano não tenha
 * `checkoutUrl`), preservando a arquitetura Asaas. NENHUMA cobrança nova
 * deve depender dele em produção.
 *
 * - O preço/duração/ciclo são SEMPRE resolvidos no servidor (`getPlanById`).
 * - O client envia apenas `planId`; nunca valor vindo do browser.
 * - Com gateway configurado, cria a cobrança/assinatura no Asaas e devolve
 *   o estado real (URL de checkout/PIX, status PENDING).
 * - Sem gateway, retorna estado controlado "Pagamento online em configuração."
 *   (nenhuma URL fake).
 *
 * IMPORTANTE: criar checkout ≠ pagamento aprovado. O acesso só é liberado
 * quando o webhook confirma o pagamento.
 */

export interface StartCheckoutResult {
  ok: boolean;
  status: "INTEGRATION_NOT_CONFIGURED" | "CONFIGURED";
  message: string;
  planId: string | null;
  planName: string | null;
  priceCents: number | null;
  checkoutUrl: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
}

/**
 * Inicia o checkout de um plano (owner = sessão).
 * `userEmail`/`userName` vêm da sessão autenticada (nunca do body).
 */
export async function startCheckout(input: {
  userId: string;
  userEmail: string;
  userName: string | null;
  planId: string;
}): Promise<StartCheckoutResult> {
  const plan = await getPlanById(input.planId);
  if (!plan || !plan.active) {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      message: "Plano não encontrado.",
      planId: input.planId,
      planName: null,
      priceCents: null,
      checkoutUrl: null,
      subscriptionId: null,
      subscriptionStatus: null,
    };
  }

  const adapter = getBillingAdapter();
  const result = await adapter.createCheckout({
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingType: plan.type === "RECURRING" ? "RECURRING" : "ONE_TIME",
    billingInterval: (plan.billingInterval as "MONTH" | "YEAR" | null) ?? null,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.status === "INTEGRATION_NOT_CONFIGURED"
        ? "Pagamento online em configuração."
        : result.error ?? "Não foi possível iniciar o checkout.",
      planId: plan.id,
      planName: plan.name,
      priceCents: plan.priceCents,
      checkoutUrl: null,
      subscriptionId: null,
      subscriptionStatus: null,
    };
  }

  return {
    ok: true,
    status: result.status,
    message: "Checkout iniciado. O acesso é liberado somente após a confirmação do pagamento.",
    planId: plan.id,
    planName: plan.name,
    priceCents: plan.priceCents,
    checkoutUrl: result.checkoutUrl,
    subscriptionId: result.externalId ?? null,
    subscriptionStatus: "PENDING",
  };
}
