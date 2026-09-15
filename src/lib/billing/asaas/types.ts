/**
 * ASAAS â€” TIPOS OFICIAIS (espelho mÃ­nimo da API v3)
 * ===================================================
 * Apenas os campos que o Inst Acessor realmente usa. Nada alÃ©m disso Ã©
 * inventado â€” campos nÃ£o mapeados sÃ£o ignorados.
 *
 * Fontes: API Asaas v3 (documentaÃ§Ã£o oficial). Nomes de eventos abaixo
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
// Payment (cobranÃ§a)
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

/** Tipo de cobranÃ§a do Checkout: avulsa ou recorrente. */
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
// CobranÃ§a criada (resposta do POST /payments)
// ------------------------------------------------------------
export interface AsaasPaymentCreated extends AsaasPayment {
  // Sem campos extras â€” herdamos de AsaasPayment.
}

// ------------------------------------------------------------
// Assinatura criada (resposta do POST /subscriptions)
// ------------------------------------------------------------
export interface AsaasSubscriptionCreated extends AsaasSubscription {
  // Sem campos extras â€” herdamos de AsaasSubscription.
}

// ------------------------------------------------------------
// Checkout hospedado oficial (POST /v3/checkouts)
// ------------------------------------------------------------
// O Asaas expÃµe um checkout HOSPEDADO (pÃ¡gina de pagamento gerenciada por ele)
// criado por POST /v3/checkouts. Diferente de POST /payments e /subscriptions
// (cobranÃ§a/assinatura "crua"), o checkout devolve uma URL pÃºblica para o
// cliente pagar â€” sem login no app.
//
// Contrato conforme a documentaÃ§Ã£o oficial atual do Asaas:
//   - `customer`      â†’ ID de customer Asaas JÃ existente (reaproveitamento).
//   - `customerData`  â†’ dados do cliente quando ele ainda NÃƒO existe no Asaas.
//     Os dois sÃ£o MUTUAMENTE EXCLUSIVOS: nunca enviar juntos.
//   - `chargeTypes`   â†’ ["DETACHED"] (cobranÃ§a avulsa) | ["RECURRENT"] (assinatura).
//   - `billingTypes`  â†’ formas de cobranÃ§a aceitas pelo checkout.
//   - `subscription`  â†’ configuraÃ§Ã£o da recorrÃªncia (cycle/nextDueDate/endDate).
//     O campo de ciclo Ã© `subscription.cycle` â€” NÃƒO existe `subscriptionCycle`.

/** Dados do cliente quando ele ainda nÃ£o existe no Asaas. */
export interface AsaasCustomerData {
  name?: string;
  email?: string;
  /** CPF ou CNPJ â€” SOMENTE dÃ­gitos (sem pontuaÃ§Ã£o). */
  cpfCnpj?: string;
  /** Telefone/WhatsApp â€” DDD + nÃºmero, somente dÃ­gitos (ex.: 11999999999). */
  phone?: string;
  /** Nome da rua/avenida (sem nÃºmero). */
  address?: string;
  /** NÃºmero do endereÃ§o. */
  addressNumber?: string;
  /** CEP â€” SOMENTE dÃ­gitos (8 caracteres). */
  postalCode?: string;
  /** Bairro. */
  province?: string;
  [key: string]: unknown;
}

/** ConfiguraÃ§Ã£o da assinatura recorrente dentro do checkout. */
export interface AsaasCheckoutSubscription {
  /** Ciclo da recorrÃªncia (MONTHLY | YEARLY). */
  cycle: AsaasSubscriptionCycle;
  /** PrÃ³ximo vencimento (YYYY-MM-DD). */
  nextDueDate: string;
  /** Fim da recorrÃªncia (YYYY-MM-DD) â€” opcional. */
  endDate?: string;
}

/**
 * Item discriminado do checkout (POST /v3/checkouts).
 * A documentaÃ§Ã£o atual do Asaas exige o campo `items` â€” sem ele a API responde
 * 400 ("O campo 'items' Ã© obrigatÃ³rio"). O `value` Ã© em REAIS (float), NUNCA em
 * centavos, e Ã© SEMPRE resolvido no servidor a partir do catÃ¡logo.
 */
export interface AsaasCheckoutItem {
  /** Nome do item (ex.: "Inst Acessor â€” Inst acessor Semanal"). */
  name: string;
  /** DescriÃ§Ã£o curta do item. */
  description?: string;
  /** Quantidade â€” sempre 1 (uma unidade de acesso). */
  quantity?: number;
  /** Valor unitÃ¡rio em Reais (float). */
  value: number;
  [key: string]: unknown;
}

/**
 * Callback do checkout hospedado â€” para onde o Asaas redireciona o CLIENTE.
 * NÃƒO confundir com o webhook (notificaÃ§Ã£o server-to-server que libera o
 * acesso); o webhook Ã© um fluxo separado e fica intacto. O callback apenas
 * leva o comprador de volta ao app em cada desfecho â€” NUNCA confirma pagamento.
 */
export interface AsaasCheckoutCallback {
  /** URL quando o pagamento Ã© concluÃ­do. */
  successUrl: string;
  /** URL quando o comprador cancela o checkout. */
  cancelUrl: string;
  /** URL quando o checkout expira. */
  expiredUrl: string;
  /** Redirecionamento automÃ¡tico apÃ³s o pagamento (opcional). */
  autoRedirect?: boolean;
  [key: string]: unknown;
}

export interface AsaasCheckoutRequest {
  /** Nome exibido no checkout (Inst Acessor â€” <plano>). */
  name: string;
  /** DescriÃ§Ã£o curta do que estÃ¡ sendo pago. */
  description?: string;
  /** Valor em Reais (float) â€” SEMPRE resolvido no servidor. */
  value: number;
  /**
   * Tipo de cobranÃ§a do checkout:
   *   - ["DETACHED"]  â†’ pagamento avulso (plano semanal, ONE_TIME).
   *   - ["RECURRENT"] â†’ assinatura recorrente (planos mensal/anual).
   */
  chargeTypes: AsaasCheckoutChargeType[];
  /**
   * Formas de cobranÃ§a aceitas. SÃ³ as que o projeto jÃ¡ define
   * (`ASAAS_BILLING_TYPE`) â€” nunca ampliamos o que a conta nÃ£o suporta.
   */
  billingTypes?: AsaasBillingTypeValue[];
  /**
   * ID do customer Asaas JÃ existente (`User.asaasCustomerId`). Enviado quando
   * o comprador jÃ¡ tem customer no Asaas, para o checkout REUTILIZÃ-LO em vez
   * de criar outro â€” evita duplicidade por usuÃ¡rio.
   * MUTUAMENTE EXCLUSIVO com `customerData`.
   */
  customer?: string;
  /**
   * Dados do cliente quando ele ainda NÃƒO existe no Asaas. NUNCA enviado
   * junto com `customer`.
   */
  customerData?: AsaasCustomerData;
  /** Vencimento da 1Âª cobranÃ§a (YYYY-MM-DD). */
  dueDate?: string;
  /** ExpiraÃ§Ã£o do checkout em minutos (10â€“1440). */
  minutesToExpire?: number;
  /** ReferÃªncia Ãºnica da ordem local (reconciliaÃ§Ã£o do webhook). */
  externalReference?: string;
  /**
   * ConfiguraÃ§Ã£o da recorrÃªncia â€” presente SOMENTE em checkout recorrente.
   * O ciclo vive em `subscription.cycle` (nÃ£o em `subscriptionCycle`).
   */
  subscription?: AsaasCheckoutSubscription;
  /** URL para a qual o Asaas redireciona apÃ³s o pagamento (nosso app). */
  redirectUrl?: string;
  /**
   * Callback do checkout (campo OBRIGATÃ“RIO na doc atual do Asaas) â€” define
   * para onde o CLIENTE volta depois de pagar (`successUrl`). NÃ£o Ã© o webhook.
   */
  callback?: AsaasCheckoutCallback;
  /**
   * Itens do checkout (campo OBRIGATÃ“RIO na doc atual do Asaas). Sempre um Ãºnico
   * item, com `quantity: 1` e `value` em Reais (float) â€” resolvido no servidor.
   */
  items?: AsaasCheckoutItem[];
  [key: string]: unknown;
}

export interface AsaasCheckoutResponse {
  /** ID do checkout no Asaas (persistido como externalCheckoutId). */
  id: string;
  name?: string | null;
  status?: string | null;
  /** URL pÃºblica do checkout hospedado (campo confirmado na doc oficial). */
  link?: string | null;
  url?: string | null;
  /** Alias alternativo de URL â€” aceito por seguranÃ§a (se a doc usar este nome). */
  checkoutUrl?: string | null;
  [key: string]: unknown;
}

// ------------------------------------------------------------
// Webhook â€” eventos CONFIRMADOS (nÃ£o inventar nomes)
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
// Asaas â€” mas a instruÃ§Ã£o do projeto manda NÃƒO extrapolar sem confirmaÃ§Ã£o).
// Aqui definimos apenas os que usamos de forma conservadora e registramos
// no relatÃ³rio que os nomes EXATOS devem ser conferidos na doc oficial antes
// de habilitar. O webhook aceita eventos por lista explÃ­cita, nÃ£o por regex.
export const ASAAS_KNOWN_EVENTS = [
  ...ASAAS_SUBSCRIPTION_EVENTS,
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_CANCELED",
  "PAYMENT_REFUNDED",
  // ConclusÃ£o do Checkout (confirmado na doc oficial). NÃƒO libera acesso por
  // conta prÃ³pria: a liberaÃ§Ã£o continua vindo de PAYMENT_CONFIRMED/
  // PAYMENT_RECEIVED. Serve para reconciliar o status do CheckoutOrder.
  "CHECKOUT_PAID",
] as const;
export type AsaasKnownEvent = (typeof ASAAS_KNOWN_EVENTS)[number];

/**
 * Objeto `checkout` do webhook (eventos CHECKOUT_*).
 * Usamos apenas `id` e `externalReference` â€” o suficiente para reconciliar o
 * CheckoutOrder local. Nada alÃ©m disso Ã© assumido do payload do checkout.
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
  /** Remetente / id do objeto quando nÃ£o aninhado. */
  object?: string | null;
  id?: string | null;
  [key: string]: unknown;
}

// ------------------------------------------------------------
// Campos de resposta padrÃ£o da API (quando nÃ£o tipados acima)
// ------------------------------------------------------------
export interface AsaasErrorResponse {
  errors?: Array<{ code?: string; description?: string }>;
  message?: string;
}



