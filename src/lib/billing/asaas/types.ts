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
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
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
export type AsaasPaymentCreated = AsaasPayment;

// ------------------------------------------------------------
// Assinatura criada (resposta do POST /subscriptions)
// ------------------------------------------------------------
export type AsaasSubscriptionCreated = AsaasSubscription;

// ------------------------------------------------------------
// Checkout hospedado oficial (POST /v3/checkouts)
// ------------------------------------------------------------
// O Asaas expõe um checkout HOSPEDADO (página de pagamento gerenciada por ele)
// criado por POST /v3/checkouts. Diferente de POST /payments e /subscriptions
// (cobrança/assinatura "crua"), o checkout devolve uma URL pública para o
// cliente pagar — sem login no app.
//
// Contrato conforme a documentação oficial atual do Asaas:
//   - `customer`      â†’ ID de customer Asaas JÁ existente (reaproveitamento).
//   - `customerData`  â†’ dados do cliente quando ele ainda NÃƒO existe no Asaas.
//     Os dois são MUTUAMENTE EXCLUSIVOS: nunca enviar juntos.
//   - `chargeTypes`   â†’ ["DETACHED"] (cobrança avulsa) | ["RECURRENT"] (assinatura).
//   - `billingTypes`  â†’ formas de cobrança aceitas pelo checkout.
//   - `subscription`  â†’ configuração da recorrência (cycle/nextDueDate/endDate).
//     O campo de ciclo é `subscription.cycle` — NÃƒO existe `subscriptionCycle`.

/** Dados do cliente quando ele ainda não existe no Asaas. */
export interface AsaasCustomerData {
  name?: string;
  email?: string;
  /** CPF ou CNPJ — SOMENTE dígitos (sem pontuação). */
  cpfCnpj?: string;
  /** Telefone/WhatsApp — DDD + número, somente dígitos (ex.: 11999999999). */
  phone?: string;
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
 * NÃƒO confundir com o webhook (notificação server-to-server que libera o
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
   *   - ["DETACHED"]  â†’ pagamento avulso (plano semanal, ONE_TIME).
   *   - ["RECURRENT"] â†’ assinatura recorrente (planos mensal/anual).
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
   * Dados do cliente quando ele ainda NÃƒO existe no Asaas. NUNCA enviado
   * junto com `customer`.
   */
  customerData?: AsaasCustomerData;
  /** Vencimento da 1Âª cobrança (YYYY-MM-DD). */
  dueDate?: string;
  /** Expiração do checkout em minutos (10“1440). */
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
   * Callback do checkout (campo OBRIGATÃ“RIO na doc atual do Asaas) — define
   * para onde o CLIENTE volta depois de pagar (`successUrl`). Não é o webhook.
   */
  callback?: AsaasCheckoutCallback;
  /**
   * Itens do checkout (campo OBRIGATÃ“RIO na doc atual do Asaas). Sempre um único
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
  link?: string | null;
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

/**
 * Prefixo da `externalReference` de checkouts criados por SESSÃO autenticada:
 * `instacessor:checkout-session:<userId>:<uuid>`. Gerado só no servidor e
 * imutável na ordem — é o marcador durável de que a identidade foi provada
 * (usado para vincular `User.asaasCustomerId` com segurança).
 */
export const CHECKOUT_SESSION_REF_PREFIX = "instacessor:checkout-session:";

/** Eventos que revogam o acesso da cobrança (estorno/chargeback/recebimento desfeito). */
export const ASAAS_REVOKING_EVENTS = [
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
] as const;

/** Recusas definitivas da cobrança (cartão/antifraude): nunca liberam acesso. */
export const ASAAS_PAYMENT_REFUSED_EVENTS = [
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
] as const;

/** Eventos oficiais que nunca liberam acesso (auditoria; recusas → ordem FAILED; CHECKOUT_CANCELED/EXPIRED → ordem pendente encerrada). */
export const ASAAS_ACK_ONLY_EVENTS = [
  ...ASAAS_PAYMENT_REFUSED_EVENTS,
  "PAYMENT_AWAITING_RISK_ANALYSIS",
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_UPDATED",
  "PAYMENT_ANTICIPATED",
  "PAYMENT_RESTORED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_DUNNING_REQUESTED",
  "PAYMENT_DUNNING_RECEIVED",
  "PAYMENT_BANK_SLIP_VIEWED",
  "PAYMENT_CHECKOUT_VIEWED",
  "CHECKOUT_CREATED",
  "CHECKOUT_CANCELED",
  "CHECKOUT_EXPIRED",
] as const;

// Eventos de pagamento (documentados como "os mesmos de Payment" na doc do
// Asaas — mas a instrução do projeto manda NÃƒO extrapolar sem confirmação).
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
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  // Desfazer um recebimento em dinheiro equivale a estorno daquela cobrança.
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  // Conclusão do Checkout (confirmado na doc oficial). NÃƒO libera acesso por
  // conta própria: a liberação continua vindo de PAYMENT_CONFIRMED/
  // PAYMENT_RECEIVED. Serve para reconciliar o status do CheckoutOrder.
  "CHECKOUT_PAID",
  // Eventos oficiais do Asaas que NÃO liberam nem revogam acesso, mas que a
  // conta envia quando a fila de webhook assina "todos os eventos de cobrança".
  // Antes ficavam fora da lista → a rota respondia 400 → o Asaas reenviava e,
  // após falhas consecutivas, PAUSAVA a fila inteira (inclusive os
  // PAYMENT_CONFIRMED seguintes). Agora são reconhecidos e registrados como
  // no-op auditável (200). Recusa de cartão/antifraude marca a ordem FAILED.
  ...ASAAS_ACK_ONLY_EVENTS,
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



