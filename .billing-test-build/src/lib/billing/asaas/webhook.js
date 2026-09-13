"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAsaasWebhook = parseAsaasWebhook;
exports.eventHasSubscription = eventHasSubscription;
const types_1 = require("./types");
function str(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
function numToCents(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return null;
    return Math.round(value * 100);
}
/**
 * Converte o payload do Asaas em um evento tipado.
 * Retorna `null` se o evento for desconhecido ou o payload for inválido.
 */
function parseAsaasWebhook(payload) {
    if (typeof payload !== "object" || payload === null)
        return null;
    const raw = payload;
    const event = raw.event;
    if (typeof event !== "string" || !types_1.ASAAS_KNOWN_EVENTS.includes(event)) {
        return null;
    }
    const payment = raw.payment ?? null;
    const subscription = raw.subscription ?? null;
    const customer = raw.customer ?? null;
    const externalCustomerId = str(customer?.id ?? payment?.customer ?? subscription?.customer ?? null);
    const externalSubscriptionId = str(subscription?.id ?? payment?.subscription ?? null);
    const externalPaymentId = str(payment?.id ?? null);
    // Determinístico: prioriza o id mais específico; fallback é proibido aqui
    // (sem eventId estável o evento não pode ser idempotente com segurança).
    const eventId = externalPaymentId ??
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
        event: event,
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
function eventHasSubscription(payload) {
    return Boolean(payload.subscription?.id || payload.payment?.subscription);
}
