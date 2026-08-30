/**
 * ASAAS — TIPOS OFICIAIS (espelho mínimo da API v3)
 * ===================================================
 * Apenas os campos que o Inst Acessor realmente usa. Nada além disso é
 * inventado — campos não mapeados são ignorados.
 *
 * Fontes: API Asaas v3 (documentação oficial). Nomes de eventos abaixo
 * usam APENAS nomes confirmados.
 */

// ------------------------------------------------------------
// Customer (clientes)
// ------------------------------------------------------------
export interface AsaasCustomer {
  id: string;
  name?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
  createdAt?: string | null;
}

// ------------------------------------------------------------
// Payment (cobrança)
// ------------------------------------------------------------
export type AsaasBillingTypeValue = "BOLETO" | "CREDIT_CARD" | "PIX";
export type AsaasPaymentStatusValue =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "CANCELED"
  | "FAILED";

export interface AsaasPayment {
  id: string;
  customer?: string | null;
  subscription?: string | null;
  value?: number | null;
  netValue?: number | null;
  billingType?: AsaasBillingTypeValue | null;
  status?: AsaasPaymentStatusValue | null;
  dueDate?: string | null;
  paidDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixQrCodeUrl?: string | null;
  pixCopiaECola?: string | null;
  description?: string | null;
  externalReference?: string | null;
  installmentNumber?: number | null;
}

// ------------------------------------------------------------
// Subscription (assinatura)
// ------------------------------------------------------------
export type AsaasSubscriptionCycle = "MONTHLY" | "YEARLY";
export type AsaasSubscriptionStatusValue =
  | "ACTIVE"
  | "INACTIVE"
  | "DELETED"
  | "OVERDUE"
  | "PENDING";

export interface AsaasSubscription {
  id: string;
  customer?: string | null;
  nextDueDate?: string | null;
  value?: number | null;
  cycle?: AsaasSubscriptionCycle | null;
  billingType?: AsaasBillingTypeValue | null;
  status?: AsaasSubscriptionStatusValue | null;
  externalReference?: string | null;
  endDate?: string | null;
}

// ------------------------------------------------------------
// Cobrança criada (resposta do POST /payments)
// ------------------------------------------------------------
export interface AsaasPaymentCreated extends AsaasPayment {
  // Sem campos extras — herdamos de AsaasPayment.
}

// ------------------------------------------------------------
// Assinatura criada (resposta do POST /subscriptions)
// ------------------------------------------------------------
export interface AsaasSubscriptionCreated extends AsaasSubscription {
  // Sem campos extras — herdamos de AsaasSubscription.
}

// ------------------------------------------------------------
// Webhook — eventos CONFIRMADOS (não inventar nomes)
// ------------------------------------------------------------
// Eventos de assinatura confirmados no escopo oficial:
export const ASAAS_SUBSCRIPTION_EVENTS = [
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
] as const;
export type AsaasSubscriptionEvent = (typeof ASAAS_SUBSCRIPTION_EVENTS)[number];

// Eventos de pagamento (documentados como "os mesmos de Payment" na doc do
// Asaas — mas a instrução do projeto manda NÃO extrapolar sem confirmação).
// Aqui definimos apenas os que usamos de forma conservadora e registramos
// no relatório que os nomes EXATOS devem ser conferidos na doc oficial antes
// de habilitar. O webhook aceita eventos por lista explícita, não por regex.
export const ASAAS_KNOWN_EVENTS = [
  ...ASAAS_SUBSCRIPTION_EVENTS,
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_CANCELED",
  "PAYMENT_REFUNDED",
] as const;
export type AsaasKnownEvent = (typeof ASAAS_KNOWN_EVENTS)[number];

/** Payload do webhook Asaas (formato oficial). */
export interface AsaasWebhookPayload {
  event: string;
  payment?: AsaasPayment | null;
  subscription?: AsaasSubscription | null;
  customer?: AsaasCustomer | null;
  /** Remetente / id do objeto quando não aninhado. */
  object?: string | null;
  id?: string | null;
  [key: string]: unknown;
}

// ------------------------------------------------------------
// Campos de resposta padrão da API (quando não tipados acima)
// ------------------------------------------------------------
export interface AsaasErrorResponse {
  errors?: Array<{ code?: string; description?: string }>;
  message?: string;
}
