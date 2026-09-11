import type { PlanView } from "@/lib/billing/plans";
import { getAppBaseUrl } from "@/lib/config/site";
import type {
  AsaasBillingTypeValue,
  AsaasCheckoutRequest,
  AsaasCheckoutResponse,
} from "./types";

/**
 * ASAAS — CHECKOUT HOSPEDADO OFICIAL (POST /v3/checkouts)
 * =========================================================
 * Núcleo PURO (sem banco, sem HTTP) que monta o request do checkout hospedado.
 * O Asaas cria uma página de pagamento pública (sem o cliente precisar ter
 * conta no Inst Acessor) e devolve uma URL.
 *
 * Regras de segurança:
 *   - NUNCA confia em preço/duração/ciclo vindos do browser: o request é
 *     montado a partir do `PlanView` resolvido NO SERVIDOR (`getPlanById` /
 *     `getPlanBySlug`), que por sua vez aplica o catálogo oficial.
 *   - Plano ONE_TIME (semanal) → NÃO envia `subscriptionCycle` (pagamento
 *     único; nunca vira assinatura recorrente).
 *   - Plano RECURRING (mensal/anual) → envia `subscriptionCycle` para o
 *     checkout criar a assinatura recorrente no Asaas ao ser pago.
 *   - `redirectUrl` aponta para o NOSSO app (getAppBaseUrl), não para o cliente.
 *
 * ⚠️ CONFIRMAÇÃO EXTERNA PENDENTE: os nomes dos campos do POST /v3/checkouts
 * não puderam ser verificados na doc oficial no sandbox (egress bloqueado) —
 * foram usados de forma CONSERVADORA com o vocabulário provado no código.
 * Ver `AsaasCheckoutRequest` em `types.ts` para detalhes.
 */

/**
 * Monta o corpo do POST /v3/checkouts.
 * `externalReference` é a âncora única de reconciliação (CheckoutOrder).
 */
export function buildHostedCheckoutRequest(input: {
  plan: PlanView;
  /** Referência única da ordem local (externalReference). */
  externalReference: string;
  /** Meio de cobrança default (config do servidor). */
  billingType: AsaasBillingTypeValue;
}): AsaasCheckoutRequest {
  const { plan } = input;
  const value = plan.priceCents / 100; // Asaas espera Reais (float).
  const dueDate = new Date().toISOString().slice(0, 10);
  const baseUrl = getAppBaseUrl();

  const request: AsaasCheckoutRequest = {
    name: `Inst Acessor — ${plan.name}`,
    description:
      plan.type === "RECURRING"
        ? `Assinatura ${plan.billingInterval === "YEAR" ? "anual" : "mensal"} Inst Acessor`
        : `Acesso de ${plan.durationDays ?? 7} dias ao Inst Acessor`,
    value,
    billingType: input.billingType,
    dueDate,
    externalReference: input.externalReference,
    redirectUrl: `${baseUrl}/checkout/retorno?referencia=${encodeURIComponent(input.externalReference)}`,
  };

  // Plano recorrente → o checkout deve criar a assinatura recorrente no Asaas.
  if (plan.type === "RECURRING" && plan.billingInterval) {
    request.subscriptionCycle =
      plan.billingInterval === "YEAR" ? "YEARLY" : "MONTHLY";
  }

  return request;
}

/**
 * Extrai a URL pública do checkout da resposta do Asaas.
 * Retorna null se a resposta não trouxer URL (fail-closed — nunca inventa).
 */
export function extractCheckoutUrl(
  response: AsaasCheckoutResponse
): string | null {
  const url = response.url ?? response.checkoutUrl ?? null;
  if (!url || typeof url !== "string" || url.trim().length === 0) return null;
  return url.trim();
}
