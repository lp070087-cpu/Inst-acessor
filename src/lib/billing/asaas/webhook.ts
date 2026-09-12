import {
  ASAAS_KNOWN_EVENTS,
  type AsaasKnownEvent,
  type AsaasWebhookPayload,
} from "./types";

/**
 * ASAAS — PARSER DE WEBHOOK
 * ===========================
 * Extrai e valida eventos do payload do Asaas.
 *
 * Regras de segurança:
 *   - O webhook NUNCA confia em `userId` vindo do payload — o dono é localizado
 *     pela referência externa (customer/subscription/payment id) no banco.
 *   - Só aceita eventos presentes em `ASAAS_KNOWN_EVENTS` (nunca por regex).
 *   - Extrai o `eventId` de forma determinística e estável para idempotência.
 */

export interface ParsedAsaasEvent {
  /** Nome oficial do evento (ex.: PAYMENT_CONFIRMED). */
  event: AsaasKnownEvent;
  /** ID externo estável para idempotência. */
  eventId: string;
  /** Referências externas (customer/subscription/payment). */
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  externalPaymentId: string | null;
  /** Dados financeiros (sanitizados antes de persistir). */
  amountCents: number | null;
  paidAt: string | null;
  status: string | null;
  /** Payload bruto (será sanitizado antes de persistir). */
  raw: AsaasWebhookPayload;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numToCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/**
 * Converte o payload do Asaas em um evento tipado.
 * Retorna `null` se o evento for desconhecido ou o payload for inválido.
 */
export function parseAsaasWebhook(payload: unknown): ParsedAsaasEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const raw = payload as AsaasWebhookPayload;
  const event = raw.event;

  if (typeof event !== "string" || !(ASAAS_KNOWN_EVENTS as readonly string[]).includes(event)) {
    return null;
  }

  const payment = raw.payment ?? null;
  const subscription = raw.subscription ?? null;
  const customer = raw.customer ?? null;

  const externalCustomerId = str(
    customer?.id ?? payment?.customer ?? subscription?.customer ?? null
  );
  const externalSubscriptionId = str(subscription?.id ?? payment?.subscription ?? null);
  const externalPaymentId = str(payment?.id ?? null);

  // Determinístico: prioriza o id mais específico; fallback é proibido aqui
  // (sem eventId estável o evento não pode ser idempotente com segurança).
  const eventId =
    externalPaymentId ??
    externalSubscriptionId ??
    externalCustomerId ??
    null;

  if (!eventId) {
    // Sem referência externa estável — não processa (evita idempotência fraca).
    return null;
  }

  const amountCents = numToCents(payment?.value ?? subscription?.value ?? null);
  const paidAt = str(payment?.paidDate ?? null);

  return {
    event: event as AsaasKnownEvent,
    eventId: `${event}:${eventId}`,
    externalCustomerId,
    externalSubscriptionId,
    externalPaymentId,
    amountCents,
    paidAt,
    status: str(payment?.status ?? subscription?.status ?? null),
    raw,
  };
}

/** Extrai o objeto `subscription` (ou `payment`) para atualizações locais. */
export function eventHasSubscription(payload: AsaasWebhookPayload): boolean {
  return Boolean(payload.subscription?.id || payload.payment?.subscription);
}
