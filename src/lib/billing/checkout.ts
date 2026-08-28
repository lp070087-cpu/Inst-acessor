import { getBillingAdapter } from "@/lib/billing/provider";
import { getPlanById } from "@/lib/billing/plans";

/**
 * CHECKOUT — Fase 6.5 (6.5.24)
 * ============================
 * Fluxo "Escolher plano". Como o gateway real ainda NÃO está configurado,
 * ao tentar pagamento o sistema retorna um estado CONTROLADO:
 *   "Pagamento online em configuração."
 * NENHUMA URL falsa é criada; NENHUM checkout fake é gerado.
 *
 * Quando o Asaas for integrado (fase futura), este ponto passará a chamar
 * o adapter real e retornará a URL de checkout oficial.
 */

export interface StartCheckoutResult {
  ok: boolean;
  status: "INTEGRATION_NOT_CONFIGURED" | "CONFIGURED";
  message: string;
  planId: string | null;
  planName: string | null;
  priceCents: number | null;
  checkoutUrl: string | null;
}

/**
 * Inicia o checkout de um plano (owner = sessão). Sempre retorna o estado
 * controlado de "pagamento em configuração" nesta fase — nunca uma URL fake.
 */
export async function startCheckout(userId: string, planId: string): Promise<StartCheckoutResult> {
  const plan = await getPlanById(planId);
  if (!plan) {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      message: "Plano não encontrado.",
      planId,
      planName: null,
      priceCents: null,
      checkoutUrl: null,
    };
  }

  const adapter = getBillingAdapter();
  const result = await adapter.createCheckout({
    userId,
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingType: plan.type === "RECURRING" ? "RECURRING" : "ONE_TIME",
    billingInterval: (plan.billingInterval as "MONTH" | "YEAR" | null) ?? null,
  });

  return {
    ok: result.ok,
    status: result.status,
    message: result.ok ? "Checkout iniciado." : "Pagamento online em configuração.",
    planId: plan.id,
    planName: plan.name,
    priceCents: plan.priceCents,
    checkoutUrl: result.checkoutUrl,
  };
}
