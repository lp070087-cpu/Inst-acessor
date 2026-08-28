import type { BillingAdapter } from "./types";

/**
 * PROVIDER SELECTOR — retorna o adapter de pagamento ativo.
 * ==========================================================
 * Nesta fase o gateway oficial (Asaas) AINDA NÃO está integrado:
 * o selector retorna um adapter "none" que sempre responde
 * INTEGRATION_NOT_CONFIGURED. NENHUMA chamada HTTP é feita.
 */

const notConfiguredAdapter: BillingAdapter = {
  name: "none",
  info: () => ({ name: "none", configured: false }),
  async createCheckout() {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      checkoutUrl: null,
      error: "Pagamento online em configuração.",
    };
  },
  async createOneTimeCharge() {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      error: "Pagamento online em configuração.",
    };
  },
  async createSubscription() {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      error: "Pagamento online em configuração.",
    };
  },
  async cancelSubscription() {
    return {
      ok: false,
      status: "INTEGRATION_NOT_CONFIGURED",
      error: "Pagamento online em configuração.",
    };
  },
};

/**
 * Retorna o adapter ativo. Como o Asaas ainda não está integrado,
 * sempre retorna o adapter "none" (desconfigurado). Quando o gateway for
 * liberado, este ponto trocará para `AsaasBillingAdapter`.
 */
export function getBillingAdapter(): BillingAdapter {
  return notConfiguredAdapter;
}

/** Indica se algum gateway real está configurado. */
export function isBillingConfigured(): boolean {
  return getBillingAdapter().info().configured;
}
