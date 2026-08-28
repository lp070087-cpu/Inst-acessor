/**
 * BILLING PROVIDER — Contrato genérico de gateway de pagamento.
 * ============================================================
 * O domínio do Inst Acessor NÃO fica preso ao gateway (ESCOPO-OFICIAL §8).
 * Nesta fase (6.5) NENHUM gateway real é integrado — a interface descreve o
 * contrato futuro e os adapters retornam INTEGRATION_NOT_CONFIGURED.
 */

export type BillingProviderName = "asaas" | "none";

export type BillingIntegrationStatus =
  | "INTEGRATION_NOT_CONFIGURED"
  | "CONFIGURED";

/** Dados mínimos para iniciar uma cobrança/checkout. */
export interface CreateCheckoutInput {
  userId: string;
  planId: string;
  planSlug: string;
  planName: string;
  priceCents: number;
  currency: string;
  billingType: "ONE_TIME" | "RECURRING";
  billingInterval?: "MONTH" | "YEAR" | null;
  successUrl?: string;
  cancelUrl?: string;
}

/** Resultado de iniciar um checkout (sem inventar URLs reais). */
export interface CreateCheckoutResult {
  ok: boolean;
  status: BillingIntegrationStatus;
  checkoutUrl: string | null;
  error?: string;
  /** Preenchido quando o gateway estiver ativo. */
  externalId?: string | null;
}

/** Dados mínimos de uma cobrança/assinatura criada no gateway. */
export interface BillingRecordResult {
  ok: boolean;
  status: BillingIntegrationStatus;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalPaymentId?: string | null;
  error?: string;
}

/** Informações de configuração do adapter. */
export interface BillingProviderInfo {
  name: BillingProviderName;
  configured: boolean;
}

/**
 * Interface de um adapter de pagamento.
 * Implementações concretas (ex.: AsaasBillingAdapter) só existirão na fase
 * em que o gateway for integrado de verdade.
 */
export interface BillingAdapter {
  name: BillingProviderName;
  info(): BillingProviderInfo;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  createOneTimeCharge(input: CreateCheckoutInput): Promise<BillingRecordResult>;
  createSubscription(input: CreateCheckoutInput): Promise<BillingRecordResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<BillingRecordResult>;
}
