import type {
  BillingAdapter,
  BillingRecordResult,
  CreateCheckoutInput,
  CreateCheckoutResult,
} from "@/lib/billing/provider/types";
import { getAsaasConfig, isAsaasConfigured } from "@/lib/billing/asaas/config";
import { startAsaasCheckout, cancelAsaasSubscription } from "@/lib/billing/asaas/service";

/**
 * ASAAS BILLING ADAPTER — ATIVO (gateway oficial)
 * ===============================================
 * O Asaas É o gateway oficial. O fluxo público (landing → checkout hospedado
 * → webhook → AccessGrant → primeiro acesso) vive em
 * `src/lib/billing/asaas/checkout-order.ts`. Este adapter implementa a
 * interface `BillingAdapter` sobre o mesmo serviço Asaas e é o retorno de
 * `getBillingAdapter()` sempre que `ASAAS_API_KEY` existe.
 *
 * REFERÊNCIA DA ARQUITETURA LEGADA (docs/ESCOPO-OFICIAL.md §12):
 * - Sandbox: https://api-sandbox.asaas.com/v3
 * - Produção: https://api.asaas.com/v3
 * - Autenticação: header `access_token` (apenas server-side).
 * - A chave Asaas NUNCA no frontend/Git/logs/código-fonte.
 *
 * Quando `ASAAS_API_KEY` está ausente, todos os métodos retornam
 * `INTEGRATION_NOT_CONFIGURED` (fail-closed) — nenhuma chamada HTTP é feita
 * e nenhuma URL fake é gerada. NENHUMA aprovação de pagamento é simulada.
 */

const NOT_CONFIGURED = {
  ok: false,
  status: "INTEGRATION_NOT_CONFIGURED" as const,
  error: "Pagamento online em configuração.",
};

export class AsaasBillingAdapter implements BillingAdapter {
  readonly name = "asaas" as const;

  info() {
    return {
      name: "asaas" as const,
      configured: isAsaasConfigured(),
    };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!isAsaasConfigured()) {
      return { ...NOT_CONFIGURED, checkoutUrl: null };
    }

    const result = await startAsaasCheckout({
      userId: input.userId,
      userEmail: input.userEmail ?? "",
      userName: input.userName ?? null,
      planId: input.planId,
    });

    if (!result.ok) {
      return { ...NOT_CONFIGURED, checkoutUrl: null };
    }

    return {
      ok: true,
      status: "CONFIGURED",
      checkoutUrl: result.checkoutUrl,
      externalId: result.subscriptionId ?? undefined,
    };
  }

  async createOneTimeCharge(input: CreateCheckoutInput): Promise<BillingRecordResult> {
    if (!isAsaasConfigured()) return NOT_CONFIGURED;

    const result = await startAsaasCheckout({
      userId: input.userId,
      userEmail: input.userEmail ?? "",
      userName: input.userName ?? null,
      planId: input.planId,
    });

    return {
      ok: result.ok,
      status: result.status,
      externalCustomerId: null,
      externalSubscriptionId: null,
      externalPaymentId: null,
      error: result.ok ? undefined : result.message,
    };
  }

  async createSubscription(input: CreateCheckoutInput): Promise<BillingRecordResult> {
    if (!isAsaasConfigured()) return NOT_CONFIGURED;

    const result = await startAsaasCheckout({
      userId: input.userId,
      userEmail: input.userEmail ?? "",
      userName: input.userName ?? null,
      planId: input.planId,
    });

    return {
      ok: result.ok,
      status: result.status,
      externalCustomerId: null,
      externalSubscriptionId: null,
      externalPaymentId: null,
      error: result.ok ? undefined : result.message,
    };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<BillingRecordResult> {
    if (!isAsaasConfigured()) return NOT_CONFIGURED;

    const cfg = getAsaasConfig();
    // O adapter não conhece o userId do dono — o cancelamento owner-checked
    // acontece na camada de serviço (cancelAsaasSubscription recebe userId+id).
    void cfg;
    return {
      ok: false,
      status: "CONFIGURED",
      error: "Use cancelAsaasSubscription (owner-check) para cancelar.",
    };
  }
}

/** Instância singleton do adapter Asaas. */
export const asaasBillingAdapter = new AsaasBillingAdapter();
