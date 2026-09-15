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

/** Tipo de cobrança do Checkout: avulsa ou recorrente. */
export type AsaasCheckoutChargeType = "DETACHED" | "RECURRENT";
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
// Checkout hospedado oficial (POST /v3/checkouts)
// ------------------------------------------------------------
// O Asaas expõe um checkout HOSPEDADO (página de pagamento gerenciada por ele)
// criado por POST /v3/checkouts. Diferente de POST /payments e /subscriptions
// (cobrança/assinatura "crua"), o checkout devolve uma URL pública para o
// cliente pagar — sem login no app.
//
// Contrato conforme a documentação oficial atual do Asaas:
//   - `customer`      → ID de customer Asaas JÁ existente (reaproveitamento).
//   - `customerData`  → dados do cliente quando ele ainda NÃO existe no Asaas.
//     Os dois são MUTUAMENTE EXCLUSIVOS: nunca enviar juntos.
//   - `chargeTypes`   → ["DETACHED"] (cobrança avulsa) | ["RECURRENT"] (assinatura).
//   - `billingTypes`  → formas de cobrança aceitas pelo checkout.
//   - `subscription`  → configuração da recorrência (cycle/nextDueDate/endDate).
//     O campo de ciclo é `subscription.cycle` — NÃO existe `subscriptionCycle`.

/** Dados do cliente quando ele ainda não existe no Asaas. */
export interface AsaasCustomerData {
  name?: string;
  email?: string;
  /** CPF ou CNPJ — SOMENTE dígitos (sem pontuação). */
  cpfCnpj?: string;
  /** Telefone/WhatsApp — E.164 (ex.: 5511999999999). */
  phoneNumber?: string;
  /** Nome da rua/avenida (sem número). */
  address?: string;
  /** Número do endereço. */
  addressNumber?: string;
  /** CEP — SOMENTE dígitos (8 caracteres). */
  postalCode?: string;
  /** Bairro. */
  province?: string;
  [key: string]: unknown;
}

/** Configuração da assinatura recorrente dentro do checkout. */
export interface AsaasCheckoutSubscription {
  /** Ciclo da recorrência (MONTHLY | YEARLY). */
  cycle: AsaasSubscriptionCycle;
  /** Próximo vencimento (YYYY-MM-DD). */
  nextDueDate: string;
  /** Fim da recorrência (YYYY-MM-DD) — opcional. */
  endDate?: string;
}

/**
 * Item discriminado do checkout (POST /v3/checkouts).
 * A documentação atual do Asaas exige o campo `items` — sem ele a API responde
 * 400 ("O campo 'items' é obrigatório"). O `value` é em REAIS (float), NUNCA em
 * centavos, e é SEMPRE resolvido no servidor a partir do catálogo.
 */
export interface AsaasCheckoutItem {
  /** Nome do item (ex.: "Inst Acessor — Inst acessor Semanal"). */
  name: string;
  /** Descrição curta do item. */
  description?: string;
  /** Quantidade — sempre 1 (uma unidade de acesso). */
  quantity?: number;
  /** Valor unitário em Reais (float). */
  value: number;
  [key: string]: unknown;
}

/**
 * Callback do checkout hospedado — para onde o Asaas redireciona o CLIENTE.
 * NÃO confundir com o webhook (notificação server-to-server que libera o
 * acesso); o webhook é um fluxo separado e fica intacto. O callback apenas
 * leva o comprador de volta ao app em cada desfecho — NUNCA confirma pagamento.
 */
export interface AsaasCheckoutCallback {
  /** URL quando o pagamento é concluído. */
  successUrl: string;
  /** URL quando o comprador cancela o checkout. */
  cancelUrl: string;
  /** URL quando o checkout expira. */
  expiredUrl: string;
  /** Redirecionamento automático após o pagamento (opcional). */
  autoRedirect?: boolean;
  [key: string]: unknown;
}

export interface AsaasCheckoutRequest {
  /** Nome exibido no checkout (Inst Acessor — <plano>). */
  name: string;
  /** Descrição curta do que está sendo pago. */
  description?: string;
  /** Valor em Reais (float) — SEMPRE resolvido no servidor. */
  value: number;
  /**
   * Tipo de cobrança do checkout:
   *   - ["DETACHED"]  → pagamento avulso (plano semanal, ONE_TIME).
   *   - ["RECURRENT"] → assinatura recorrente (planos mensal/anual).
   */
  chargeTypes: AsaasCheckoutChargeType[];
  /**
   * Formas de cobrança aceitas. Só as que o projeto já define
   * (`ASAAS_BILLING_TYPE`) — nunca ampliamos o que a conta não suporta.
   */
  billingTypes?: AsaasBillingTypeValue[];
  /**
   * ID do customer Asaas JÁ existente (`User.asaasCustomerId`). Enviado quando
   * o comprador já tem customer no Asaas, para o checkout REUTILIZÁ-LO em vez
   * de criar outro — evita duplicidade por usuário.
   * MUTUAMENTE EXCLUSIVO com `customerData`.
   */
  customer?: string;
  /**
   * Dados do cliente quando ele ainda NÃO existe no Asaas. NUNCA enviado
   * junto com `customer`.
   */
  customerData?: AsaasCustomerData;
  /** Vencimento da 1ª cobrança (YYYY-MM-DD). */
  dueDate?: string;
  /** Expiração do checkout em minutos (10–1440). */
  minutesToExpire?: number;
  /** Referência única da ordem local (reconciliação do webhook). */
  externalReference?: string;
  /**
   * Configuração da recorrência — presente SOMENTE em checkout recorrente.
   * O ciclo vive em `subscription.cycle` (não em `subscriptionCycle`).
   */
  subscription?: AsaasCheckoutSubscription;
  /** URL para a qual o Asaas redireciona após o pagamento (nosso app). */
  redirectUrl?: string;
  /**
   * Callback do checkout (campo OBRIGATÓRIO na doc atual do Asaas) — define
   * para onde o CLIENTE volta depois de pagar (`successUrl`). Não é o webhook.
   */
  callback?: AsaasCheckoutCallback;
  /**
   * Itens do checkout (campo OBRIGATÓRIO na doc atual do Asaas). Sempre um único
   * item, com `quantity: 1` e `value` em Reais (float) — resolvido no servidor.
   */
  items?: AsaasCheckoutItem[];
  [key: string]: unknown;
}

export interface AsaasCheckoutResponse {
  /** ID do checkout no Asaas (persistido como externalCheckoutId). */
  id: string;
  name?: string | null;
  status?: string | null;
  /** URL pública do checkout hospedado (campo confirmado na doc oficial). */
  url?: string | null;
  /** Alias alternativo de URL — aceito por segurança (se a doc usar este nome). */
  checkoutUrl?: string | null;
  [key: string]: unknown;
}

// ------------------------------------------------------------
// Webhook — eventos CONFIRMADOS (não inventar nomes)
// ------------------------------------------------------------
// Eventos de assinatura confirmados na doc oficial:
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
  // Conclusão do Checkout (confirmado na doc oficial). NÃO libera acesso por
  // conta própria: a liberação continua vindo de PAYMENT_CONFIRMED/
  // PAYMENT_RECEIVED. Serve para reconciliar o status do CheckoutOrder.
  "CHECKOUT_PAID",
] as const;
export type AsaasKnownEvent = (typeof ASAAS_KNOWN_EVENTS)[number];

/**
 * Objeto `checkout` do webhook (eventos CHECKOUT_*).
 * Usamos apenas `id` e `externalReference` — o suficiente para reconciliar o
 * CheckoutOrder local. Nada além disso é assumido do payload do checkout.
 */
export interface AsaasCheckoutWebhook {
  id?: string | null;
  externalReference?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

/** Payload do webhook Asaas (formato oficial). */
export interface AsaasWebhookPayload {
  event: string;
  payment?: AsaasPayment | null;
  subscription?: AsaasSubscription | null;
  customer?: AsaasCustomer | null;
  /** Presente em eventos de checkout (ex.: CHECKOUT_PAID). */
  checkout?: AsaasCheckoutWebhook | null;
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
