import type { BillingAdapter } from "./types";
import { isAsaasConfigured } from "@/lib/billing/asaas/config";
import { asaasBillingAdapter } from "@/lib/billing/adapters/asaas";

/**
 * PROVIDER SELECTOR — retorna o adapter de pagamento ativo.
 * ==========================================================
 * - Se `ASAAS_API_KEY` estiver configurada no servidor → AsaasBillingAdapter.
 * - Caso contrário → adapter "none" (INTEGRATION_NOT_CONFIGURED).
 * NENHUMA chamada HTTP é feita na seleção.
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
 * Retorna o adapter ativo. Com `ASAAS_API_KEY` presente, retorna o adapter
 * Asaas real; sem chave, retorna o adapter "none" (desconfigurado).
 */
export function getBillingAdapter(): BillingAdapter {
  return isAsaasConfigured() ? asaasBillingAdapter : notConfiguredAdapter;
}

/** Indica se algum gateway real está configurado. */
export function isBillingConfigured(): boolean {
  return getBillingAdapter().info().configured;
}
