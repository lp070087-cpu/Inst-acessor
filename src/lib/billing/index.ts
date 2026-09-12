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

// Asaas (integração real, server-only)
export * from "./asaas";

// Liberação manual de acesso pelo ADMIN (sem cobrança, sem Asaas)
export {
  grantManualAccess,
  type GrantManualAccessResult,
} from "./manual-access";
export {
  MANUAL_PROVIDER,
  MANUAL_SOURCE,
  ASAAS_PROVIDER,
  ASAAS_SOURCE,
  MANUAL_MIN_DAYS,
  MANUAL_MAX_DAYS,
  normalizeEmail,
  validateGrantDays,
  computeGrantDates,
  computeExtendedExpiry,
  resolveAnchorPlanSlug,
} from "./manual-access-core";
