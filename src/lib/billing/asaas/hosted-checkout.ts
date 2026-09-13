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
 * Contrato (documentação oficial atual do Asaas):
 *   - `chargeTypes: ["DETACHED"]`  → pagamento AVULSO (plano semanal).
 *   - `chargeTypes: ["RECURRENT"]` → ASSINATURA recorrente (mensal/anual), com
 *     `subscription: { cycle, nextDueDate }`. O ciclo vive em `subscription.cycle`
 *     — NÃO existe `subscriptionCycle` no POST /v3/checkouts.
 *   - `customer` vs `customerData` são MUTUAMENTE EXCLUSIVOS: usamos `customer`
 *     quando já existe `User.asaasCustomerId`; caso contrário, `customerData`
 *     com nome/e-mail. NUNCA os dois juntos.
 *
 * Regras de segurança:
 *   - NUNCA confia em preço/duração/ciclo vindos do browser: o request é
 *     montado a partir do `PlanView` resolvido NO SERVIDOR (`getPlanById` /
 *     `getPlanBySlug`), que por sua vez aplica o catálogo oficial.
 *   - `redirectUrl` aponta para o NOSSO app (getAppBaseUrl), não para o cliente.
 *   - Formas de cobrança: enviamos apenas a definida pelo servidor
 *     (`ASAAS_BILLING_TYPE`) — nunca ampliamos o que a conta não suporta.
 *   - CRIAR CHECKOUT ≠ PAGAMENTO: nada é liberado aqui. A liberação só ocorre
 *     pelo webhook validado (PAYMENT_CONFIRMED / PAYMENT_RECEIVED).
 */

/** Data de hoje em YYYY-MM-DD (formato de data do Asaas). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Monta o corpo do POST /v3/checkouts.
 * `externalReference` é a âncora única de reconciliação (CheckoutOrder).
 */
export function buildHostedCheckoutRequest(input: {
  plan: PlanView;
  /** Referência única da ordem local (externalReference). */
  externalReference: string;
  /** Meio de cobrança definido pelo servidor (ASAAS_BILLING_TYPE). */
  billingType: AsaasBillingTypeValue;
  /**
   * `User.asaasCustomerId` do comprador, quando já existir.
   * Presente → usamos `customer` e NÃO enviamos `customerData`.
   */
  asaasCustomerId?: string | null;
  /** Nome do comprador — usado em `customerData` quando não há customer. */
  buyerName?: string | null;
  /** E-mail do comprador — usado em `customerData` quando não há customer. */
  buyerEmail?: string | null;
}): AsaasCheckoutRequest {
  const { plan } = input;
  const value = plan.priceCents / 100; // Asaas espera Reais (float).
  const dueDate = todayIso();
  const baseUrl = getAppBaseUrl();
  const recurring = plan.type === "RECURRING" && Boolean(plan.billingInterval);

  const request: AsaasCheckoutRequest = {
    name: `Inst Acessor — ${plan.name}`,
    description: recurring
      ? `Assinatura ${plan.billingInterval === "YEAR" ? "anual" : "mensal"} Inst Acessor`
      : `Acesso de ${plan.durationDays ?? 7} dias ao Inst Acessor`,
    value,
    // Avulso vs recorrente é o que define o tipo de cobrança do checkout.
    chargeTypes: [recurring ? "RECURRENT" : "DETACHED"],
    // Apenas a forma definida pelo servidor (nunca ampliamos as aceitas).
    billingTypes: [input.billingType],
    dueDate,
    externalReference: input.externalReference,
    redirectUrl: `${baseUrl}/checkout/retorno?referencia=${encodeURIComponent(input.externalReference)}`,
  };

  // Customer: REUTILIZA o existente OU envia os dados para criar um novo.
  // Os dois campos são mutuamente exclusivos — nunca ambos.
  const customerId = (input.asaasCustomerId ?? "").trim();
  if (customerId) {
    request.customer = customerId;
  } else {
    const email = (input.buyerEmail ?? "").trim();
    const name = (input.buyerName ?? "").trim();
    // `customerData` só faz sentido com pelo menos um dado identificador.
    if (email || name) {
      request.customerData = {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      };
    }
  }

  // Recorrência: o ciclo vive em `subscription.cycle`.
  if (recurring) {
    request.subscription = {
      cycle: plan.billingInterval === "YEAR" ? "YEARLY" : "MONTHLY",
      nextDueDate: dueDate,
    };
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
