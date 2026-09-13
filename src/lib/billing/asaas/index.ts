/**
 * ASAAS — BARREL PÚBLICO (server-only)
 * =====================================
 * Camada de integração real com o Asaas. NENHUM destes módulos deve ser
 * importado em client component — contêm segredos do servidor.
 */

export {
  getAsaasConfig,
  isAsaasConfigured,
  asaasEnvironmentLabel,
  asaasStatus,
  asaasWebhookTokenIssue,
  ASAAS_SANDBOX_URL,
  ASAAS_PRODUCTION_URL,
  type AsaasConfig,
  type AsaasEnvironment,
  type AsaasBillingType,
} from "./config";

export {
  asaasClient,
  AsaasHttpError,
  AsaasNotConfiguredError,
  sanitizeAsaasPayload,
  ASAAS_TIMEOUT_MS,
} from "./client";

export type {
  AsaasCustomer,
  AsaasPayment,
  AsaasPaymentCreated,
  AsaasSubscription,
  AsaasSubscriptionCreated,
  AsaasCheckoutRequest,
  AsaasCheckoutResponse,
  AsaasCheckoutChargeType,
  AsaasCheckoutSubscription,
  AsaasCustomerData,
  AsaasCheckoutWebhook,
  AsaasBillingTypeValue,
  AsaasPaymentStatusValue,
  AsaasSubscriptionStatusValue,
  AsaasSubscriptionCycle,
  AsaasWebhookPayload,
  AsaasKnownEvent,
  AsaasSubscriptionEvent,
} from "./types";

export {
  ASAAS_SUBSCRIPTION_EVENTS,
  ASAAS_KNOWN_EVENTS,
} from "./types";

export {
  parseAsaasWebhook,
  eventHasSubscription,
  type ParsedAsaasEvent,
} from "./webhook";
