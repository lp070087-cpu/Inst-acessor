import type { PlanView } from "@/lib/billing/plans";
import { getAppBaseUrl } from "@/lib/config/site";
import type { AsaasConfig } from "./config";
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
 *   - `chargeTypes: ["DETACHED"]`  â†’ pagamento AVULSO (plano semanal).
 *   - `chargeTypes: ["RECURRENT"]` â†’ ASSINATURA recorrente (mensal/anual), com
 *     `subscription: { cycle, nextDueDate }`. O ciclo vive em `subscription.cycle`
 *     — NÃƒO existe `subscriptionCycle` no POST /v3/checkouts.
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
 *   - CRIAR CHECKOUT â‰  PAGAMENTO: nada é liberado aqui. A liberação só ocorre
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
   * Presente â†’ usamos `customer` e NÃƒO enviamos `customerData`.
   */
  asaasCustomerId?: string | null;
  /** Nome do comprador — usado em `customerData` quando não há customer. */
  buyerName?: string | null;
  /** E-mail do comprador — usado em `customerData` quando não há customer. */
  buyerEmail?: string | null;
  /** CPF/CNPJ — somente dígitos (normalizado pelo servidor). */
  buyerCpfCnpj?: string | null;
  /** Telefone/WhatsApp — DDD + número, somente dígitos (normalizado no servidor). */
  buyerPhone?: string | null;
  /** Endereço (rua/avenida, sem número). */
  buyerAddress?: string | null;
  /** Número do endereço. */
  buyerAddressNumber?: string | null;
  /** CEP — somente dígitos. */
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

  // `name` curto e estável (limite do Asaas: 30 caracteres). O `plan.name` real
  // não cabe no limite — usamos rótulos fixos por tipo de plano:
  //   Semanal = "Inst Acessor - Semanal" (22) | Mensal = "Inst Acessor - Mensal"
  //   (22) | Anual = "Inst Acessor - Anual" (21). Descrição continua detalhada.
  const shortLabel = recurring
    ? plan.billingInterval === "YEAR"
      ? "Anual"
      : "Mensal"
    : "Semanal";
  const name = `Inst Acessor - ${shortLabel}`; // â‰¤ 30 caracteres.
  const description = recurring
    ? `Assinatura ${plan.billingInterval === "YEAR" ? "anual" : "mensal"} Inst Acessor`
    : `Acesso de ${plan.durationDays ?? 7} dias ao Inst Acessor`;

  // URL de retorno do CLIENTE (nosso app), sempre preservando a referência da
  // ordem. O `status` diferencia apenas o desfecho visual — NUNCA prova
  // pagamento (a confirmação vem exclusivamente do webhook).
  const ref = encodeURIComponent(input.externalReference);
  const retorno = (status: "sucesso" | "cancelado" | "expirado") =>
    `${baseUrl}/checkout/retorno?status=${status}&referencia=${ref}`;

  const request: AsaasCheckoutRequest = {
    name,
    description,
    value,
    // A documentação atual do Asaas exige `items` (campo obrigatório). Ã‰ um
    // único item — a unidade de acesso deste plano — com `quantity: 1` e o
    // `value` em REAIS (já convertido de centavos exatamente uma vez, acima).
    items: [{ name, description, quantity: 1, value }],
    // Avulso vs recorrente é o que define o tipo de cobrança do checkout.
    chargeTypes: [recurring ? "RECURRENT" : "DETACHED"],
    // Apenas a forma definida pelo servidor (nunca ampliamos as aceitas).
    billingTypes: recurring ? ["CREDIT_CARD"] : ["PIX", "CREDIT_CARD"],
    dueDate,
    // Expiração conservadora do checkout hospedado (limite: 10“1440 min).
    minutesToExpire: 60,
    externalReference: input.externalReference,
    redirectUrl: retorno("sucesso"),
    // Callback obrigatório na doc atual do Asaas — as 3 URLs de retorno do
    // CLIENTE. NÃƒO é o webhook (fluxo separado, intacto).
    callback: {
      successUrl: retorno("sucesso"),
      cancelUrl: retorno("cancelado"),
      expiredUrl: retorno("expirado"),
    },
  };

  // Customer: REUTILIZA o existente OU envia os dados para criar um novo.
  // Os dois campos são mutuamente exclusivos — nunca ambos.
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
    // `customerData` só faz sentido com pelo menos um dado identificador.
    if (email || name) {
      request.customerData = {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        // Dados obrigatórios do comprador (checkout hospedado do Asaas).
        // Todos já chegam normalizados do servidor — nunca inventados aqui.
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
        ...(addressNumber ? { addressNumber } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(province ? { province } : {}),
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

function checkoutHosts(baseUrl: string): string[] | null {
  const effectiveBase = baseUrl.replace(/\/+$/, "");
  return effectiveBase === "https://api-sandbox.asaas.com/v3" ? ["sandbox.asaas.com"]
    : effectiveBase === "https://api.asaas.com/v3" ? ["asaas.com", "www.asaas.com"] : null;
}

/** Pure preflight shared by order creation and ID-only URL construction.
 * Explicit origin is required; environment labels never override the effective API URL. */
export function getAsaasCheckoutOrigin(config: Pick<AsaasConfig, "baseUrl" | "checkoutOrigin">, sandboxOnly = false): string | null {
  if (sandboxOnly && config.baseUrl.replace(/\/+$/, "") !== "https://api-sandbox.asaas.com/v3") return null;
  const hosts = checkoutHosts(config.baseUrl);
  if (!hosts || !config.checkoutOrigin) return null;
  try {
    const origin = new URL(config.checkoutOrigin);
    if (origin.protocol !== "https:" || !hosts.includes(origin.hostname) || origin.username || origin.password ||
        origin.port || origin.search || origin.hash || origin.pathname !== "/") return null;
    return origin.origin;
  } catch { return null; }
}

/**
 * Extrai a URL pública do checkout da resposta do Asaas.
 * Aceita aliases históricos ou ID com origem explicitamente configurada.
 * Sem destino comprovável, retorna null (fail-closed).
 */
export function extractCheckoutUrl(
  response: AsaasCheckoutResponse,
  config?: Pick<AsaasConfig, "baseUrl" | "checkoutOrigin">
): string | null {
  // Historical responses expose different aliases. A blank/malformed alias
  // must not hide a valid one, and provider data must not become an arbitrary
  // browser redirect. Exact hosts reject lookalikes, credentials and subdomains.
  let hosts = new Set(["asaas.com", "www.asaas.com", "sandbox.asaas.com"]);
  if (config) {
    // Environment labels can be overridden. Trust only the effective API URL.
    const allowed = checkoutHosts(config.baseUrl);
    if (!allowed) return null;
    hosts = new Set(allowed);
  }
  for (const candidate of [response.link, response.url, response.checkoutUrl]) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    try {
      const url = new URL(candidate.trim());
      if (url.protocol !== "https:" || !hosts.has(url.hostname) ||
          url.username || url.password || url.port || url.hash) continue;
      if (url.pathname !== "/checkoutSession/show" || !url.searchParams.get("id")?.trim()) continue;
      // Checkout URLs do not need an arbitrary return destination. The return
      // journey is configured in the server-created callback, not this URL.
      if ([...url.searchParams.keys()].length !== 1 || !url.searchParams.has("id")) continue;
      return url.href;
    } catch {
      // Try the next historical alias; fail closed if none is usable.
    }
  }
  // Current API documentation describes an ID-only response. Never infer a
  // production destination when the hosted origin has not been configured.
  // Sandbox must have its own explicitly confirmed hosted origin.
  if (config && typeof response.id === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(response.id)) {
    const origin = getAsaasCheckoutOrigin(config);
    if (origin) {
      const checkout = new URL("/checkoutSession/show", origin);
      checkout.searchParams.set("id", response.id);
      return checkout.href;
    }
  }
  return null;
}





