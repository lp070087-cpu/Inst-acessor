import type {
  BillingAdapter,
  BillingRecordResult,
  CreateCheckoutInput,
  CreateCheckoutResult,
} from "@/lib/billing/provider/types";

/**
 * ASAAS BILLING ADAPTER — conceitual (Fase 6.5)
 * ==============================================
 * Adapter do gateway oficial de pagamento do Inst Acessor.
 *
 * DECISÃO OFICIAL (registrada em docs/ESCOPO-OFICIAL.md):
 * - Gateway futuro oficial: **Asaas**.
 * - Sandbox: https://api-sandbox.asaas.com/v3
 * - Produção: https://api.asaas.com/v3
 * - Autenticação: header `access_token`.
 * - Também obrigatório: `Content-Type: application/json` e
 *   `User-Agent` identificando o Inst Acessor.
 * - A chave Asaas: NUNCA no frontend, NUNCA no GitHub, NUNCA em logs,
 *   NUNCA em código-fonte — SOMENTE environment variable server-side.
 *
 * NESTA FASE: NENHUMA chamada HTTP é feita. Todos os métodos retornam
 * `INTEGRATION_NOT_CONFIGURED`. A chave NÃO é solicitada nem criada.
 *
 * Quando a DONA liberar a integração real (fase futura), este arquivo será
 * preenchido com o cliente Asaas real (fetch server-side), lendo a chave de
 * `process.env.ASAAS_API_KEY` (nunca exposta ao client).
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
      // Somente será `true` quando ASAAS_API_KEY estiver presente no server.
      configured: false,
    };
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return { ...NOT_CONFIGURED, checkoutUrl: null };
  }

  async createOneTimeCharge(_input: CreateCheckoutInput): Promise<BillingRecordResult> {
    return NOT_CONFIGURED;
  }

  async createSubscription(_input: CreateCheckoutInput): Promise<BillingRecordResult> {
    return NOT_CONFIGURED;
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<BillingRecordResult> {
    return NOT_CONFIGURED;
  }
}

/** Instância singleton do adapter Asaas (conceitual). */
export const asaasBillingAdapter = new AsaasBillingAdapter();
