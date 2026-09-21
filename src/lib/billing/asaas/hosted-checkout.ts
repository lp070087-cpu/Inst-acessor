import type { PlanView } from "@/lib/billing/plans";
import { getAppBaseUrl } from "@/lib/config/site";
import type {
  AsaasBillingTypeValue,
  AsaasCheckoutRequest,
  AsaasCheckoutResponse,
} from "./types";

/**
 * ASAAS â€” CHECKOUT HOSPEDADO OFICIAL (POST /v3/checkouts)
 * =========================================================
 * NÃºcleo PURO (sem banco, sem HTTP) que monta o request do checkout hospedado.
 * O Asaas cria uma pÃ¡gina de pagamento pÃºblica (sem o cliente precisar ter
 * conta no Inst Acessor) e devolve uma URL.
 *
 * Contrato (documentaÃ§Ã£o oficial atual do Asaas):
 *   - `chargeTypes: ["DETACHED"]`  â†’ pagamento AVULSO (plano semanal).
 *   - `chargeTypes: ["RECURRENT"]` â†’ ASSINATURA recorrente (mensal/anual), com
 *     `subscription: { cycle, nextDueDate }`. O ciclo vive em `subscription.cycle`
 *     â€” NÃƒO existe `subscriptionCycle` no POST /v3/checkouts.
 *   - `customer` vs `customerData` sÃ£o MUTUAMENTE EXCLUSIVOS: usamos `customer`
 *     quando jÃ¡ existe `User.asaasCustomerId`; caso contrÃ¡rio, `customerData`
 *     com nome/e-mail. NUNCA os dois juntos.
 *
 * Regras de seguranÃ§a:
 *   - NUNCA confia em preÃ§o/duraÃ§Ã£o/ciclo vindos do browser: o request Ã©
 *     montado a partir do `PlanView` resolvido NO SERVIDOR (`getPlanById` /
 *     `getPlanBySlug`), que por sua vez aplica o catÃ¡logo oficial.
 *   - `redirectUrl` aponta para o NOSSO app (getAppBaseUrl), nÃ£o para o cliente.
 *   - Formas de cobranÃ§a: enviamos apenas a definida pelo servidor
 *     (`ASAAS_BILLING_TYPE`) â€” nunca ampliamos o que a conta nÃ£o suporta.
 *   - CRIAR CHECKOUT â‰  PAGAMENTO: nada Ã© liberado aqui. A liberaÃ§Ã£o sÃ³ ocorre
 *     pelo webhook validado (PAYMENT_CONFIRMED / PAYMENT_RECEIVED).
 */

/** Data de hoje em YYYY-MM-DD (formato de data do Asaas). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Monta o corpo do POST /v3/checkouts.
 * `externalReference` Ã© a Ã¢ncora Ãºnica de reconciliaÃ§Ã£o (CheckoutOrder).
 */
export function buildHostedCheckoutRequest(input: {
  plan: PlanView;
  /** ReferÃªncia Ãºnica da ordem local (externalReference). */
  externalReference: string;
  /** Meio de cobranÃ§a definido pelo servidor (ASAAS_BILLING_TYPE). */
  billingType: AsaasBillingTypeValue;
  /**
   * `User.asaasCustomerId` do comprador, quando jÃ¡ existir.
   * Presente â†’ usamos `customer` e NÃƒO enviamos `customerData`.
   */
  asaasCustomerId?: string | null;
  /** Nome do comprador â€” usado em `customerData` quando nÃ£o hÃ¡ customer. */
  buyerName?: string | null;
  /** E-mail do comprador â€” usado em `customerData` quando nÃ£o hÃ¡ customer. */
  buyerEmail?: string | null;
  /** CPF/CNPJ â€” somente dÃ­gitos (normalizado pelo servidor). */
  buyerCpfCnpj?: string | null;
  /** Telefone/WhatsApp â€” DDD + nÃºmero, somente dÃ­gitos (normalizado no servidor). */
  buyerPhone?: string | null;
  /** EndereÃ§o (rua/avenida, sem nÃºmero). */
  buyerAddress?: string | null;
  /** NÃºmero do endereÃ§o. */
  buyerAddressNumber?: string | null;
  /** CEP â€” somente dÃ­gitos. */
  buyerPostalCode?: string | null;
  /** Bairro. */
  buyerProvince?: string | null;
  /**
   * Preço a COBRAR, em centavos, já resolvido no SERVIDOR (P17–P21).
   * Vem de `resolveCheckoutPrice()` — catálogo + promoção + histórico REAL do
   * comprador — e NUNCA do navegador. Quando ausente, usa `plan.priceCents`.
   * Um valor não-inteiro/não-positivo é ignorado (e vale o preço cheio).
   */
  chargePriceCents?: number | null;
}): AsaasCheckoutRequest {
  const { plan } = input;
  const chargeCents =
    typeof input.chargePriceCents === "number" &&
    Number.isInteger(input.chargePriceCents) &&
    input.chargePriceCents > 0
      ? input.chargePriceCents
      : plan.priceCents;
  const value = chargeCents / 100; // Asaas espera Reais (float).
  const dueDate = todayIso();
  const baseUrl = getAppBaseUrl();
  const recurring = plan.type === "RECURRING" && Boolean(plan.billingInterval);

  // `name` curto e estÃ¡vel (limite do Asaas: 30 caracteres). O `plan.name` real
  // nÃ£o cabe no limite â€” usamos rÃ³tulos fixos por tipo de plano:
  //   Semanal = "Inst Acessor - Semanal" (22) | Mensal = "Inst Acessor - Mensal"
  //   (22) | Anual = "Inst Acessor - Anual" (21). DescriÃ§Ã£o continua detalhada.
  const shortLabel = recurring
    ? plan.billingInterval === "YEAR"
      ? "Anual"
      : "Mensal"
    : "Semanal";
  const name = `Inst Acessor - ${shortLabel}`; // â‰¤ 30 caracteres.
  const description = recurring
    ? `Assinatura ${plan.billingInterval === "YEAR" ? "anual" : "mensal"} Inst Acessor`
    : `Acesso de ${plan.durationDays ?? 7} dias ao Inst Acessor`;

  // URL de retorno do CLIENTE (nosso app), sempre preservando a referÃªncia da
  // ordem. O `status` diferencia apenas o desfecho visual â€” NUNCA prova
  // pagamento (a confirmaÃ§Ã£o vem exclusivamente do webhook).
  const ref = encodeURIComponent(input.externalReference);
  const retorno = (status: "sucesso" | "cancelado" | "expirado") =>
    `${baseUrl}/checkout/retorno?status=${status}&referencia=${ref}`;

  const request: AsaasCheckoutRequest = {
    name,
    description,
    value,
    // A documentaÃ§Ã£o atual do Asaas exige `items` (campo obrigatÃ³rio). Ã‰ um
    // Ãºnico item â€” a unidade de acesso deste plano â€” com `quantity: 1` e o
    // `value` em REAIS (jÃ¡ convertido de centavos exatamente uma vez, acima).
    items: [{ name, description, quantity: 1, value }],
    // Avulso vs recorrente Ã© o que define o tipo de cobranÃ§a do checkout.
    chargeTypes: [recurring ? "RECURRENT" : "DETACHED"],
    // Apenas a forma definida pelo servidor (nunca ampliamos as aceitas).
    billingTypes: recurring ? ["CREDIT_CARD"] : ["PIX", "CREDIT_CARD"],
    dueDate,
    // ExpiraÃ§Ã£o conservadora do checkout hospedado (limite: 10â€“1440 min).
    minutesToExpire: 60,
    externalReference: input.externalReference,
    redirectUrl: retorno("sucesso"),
    // Callback obrigatÃ³rio na doc atual do Asaas â€” as 3 URLs de retorno do
    // CLIENTE. NÃƒO Ã© o webhook (fluxo separado, intacto).
    callback: {
      successUrl: retorno("sucesso"),
      cancelUrl: retorno("cancelado"),
      expiredUrl: retorno("expirado"),
    },
  };

  // Customer: REUTILIZA o existente OU envia os dados para criar um novo.
  // Os dois campos sÃ£o mutuamente exclusivos â€” nunca ambos.
  const customerId = (input.asaasCustomerId ?? "").trim();
  if (customerId) {
    request.customer = customerId;
  } else {
    const email = (input.buyerEmail ?? "").trim();
    const name = (input.buyerName ?? "").trim();
    const cpfCnpj = (input.buyerCpfCnpj ?? "").trim();
    const phone = (input.buyerPhone ?? "").trim();
    const address = (input.buyerAddress ?? "").trim();
    const addressNumber = (input.buyerAddressNumber ?? "").trim();
    const postalCode = (input.buyerPostalCode ?? "").trim();
    const province = (input.buyerProvince ?? "").trim();
    // `customerData` sÃ³ faz sentido com pelo menos um dado identificador.
    if (email || name) {
      request.customerData = {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        // Dados obrigatÃ³rios do comprador (checkout hospedado do Asaas).
        // Todos jÃ¡ chegam normalizados do servidor â€” nunca inventados aqui.
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
        ...(addressNumber ? { addressNumber } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(province ? { province } : {}),
      };
    }
  }

  // RecorrÃªncia: o ciclo vive em `subscription.cycle`.
  if (recurring) {
    request.subscription = {
      cycle: plan.billingInterval === "YEAR" ? "YEARLY" : "MONTHLY",
      nextDueDate: dueDate,
    };
  }

  return request;
}

/**
 * Extrai a URL pÃºblica do checkout da resposta do Asaas.
 * Retorna null se a resposta nÃ£o trouxer URL (fail-closed â€” nunca inventa).
 */
export function extractCheckoutUrl(
  response: AsaasCheckoutResponse
): string | null {
  const url = response.link ?? response.url ?? response.checkoutUrl ?? null;
  if (!url || typeof url !== "string" || url.trim().length === 0) return null;
  return url.trim();
}





