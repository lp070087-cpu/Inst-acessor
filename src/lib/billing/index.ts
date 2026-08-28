/**
 * BILLING — BARREL PÚBLICO (Fase 6.5)
 * ====================================
 * Camada de assinatura/planos desacoplada do gateway.
 * NENHUM gateway real é chamado nesta fase.
 */

export { bll } from "./db";

// Planos
export {
  PLAN_CATALOG,
  listPlans,
  getPlanById,
  getPlanBySlug,
  seedPlanCatalog,
  type PlanSlug,
  type PlanView,
} from "./plans";

// Assinaturas
export {
  SUBSCRIPTION_STATUSES,
  getMySubscription,
  listMySubscriptions,
  createPendingSubscription,
  cancelRenewal,
  canAccessPaidFeatures,
  getAccessStatus,
  type SubscriptionView,
  type SubscriptionStatus,
} from "./subscriptions";

// Provider + Adapters
export {
  getBillingAdapter,
  isBillingConfigured,
} from "./provider";
export {
  AsaasBillingAdapter,
  asaasBillingAdapter,
} from "./adapters/asaas";
export type {
  BillingAdapter,
  BillingProviderInfo,
  BillingProviderName,
  BillingIntegrationStatus,
  CreateCheckoutInput,
  CreateCheckoutResult,
  BillingRecordResult,
} from "./provider/types";
