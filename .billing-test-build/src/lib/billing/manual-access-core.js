"use strict";
/**
 * LIBERAÇÃO MANUAL DE ACESSO — NÚCLEO PURO (sem banco)
 * ======================================================
 * Regras de negócio da liberação manual feita pelo ADMIN, isoladas para
 * testes determinísticos (`npm run billing:test`) sem instanciar o Prisma.
 *
 * Diferenciação de origem:
 *   - `provider = "manual"` e `accessSource = "ADMIN_MANUAL"` → acesso manual.
 *   - `provider = "asaas"`  e `accessSource = "ASAAS"`       → acesso pago.
 * Isso permite à fase futura ("primeiro acesso") saber a origem exata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANUAL_MAX_DAYS = exports.MANUAL_MIN_DAYS = exports.ASAAS_SOURCE = exports.ASAAS_PROVIDER = exports.MANUAL_SOURCE = exports.MANUAL_PROVIDER = void 0;
exports.normalizeEmail = normalizeEmail;
exports.validateGrantDays = validateGrantDays;
exports.computeGrantDates = computeGrantDates;
exports.computeExtendedExpiry = computeExtendedExpiry;
exports.resolveAnchorPlanSlug = resolveAnchorPlanSlug;
exports.MANUAL_PROVIDER = "manual";
exports.MANUAL_SOURCE = "ADMIN_MANUAL";
exports.ASAAS_PROVIDER = "asaas";
exports.ASAAS_SOURCE = "ASAAS";
exports.MANUAL_MIN_DAYS = 1;
exports.MANUAL_MAX_DAYS = 3650;
/** Normaliza e-mail (trim + lowercase). Retorna null se inválido. */
function normalizeEmail(email) {
    const e = (email ?? "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
/** Valida duração em dias (inteiro 1..3650). */
function validateGrantDays(days) {
    return Number.isInteger(days) && days >= exports.MANUAL_MIN_DAYS && days <= exports.MANUAL_MAX_DAYS;
}
/** Data de início = agora; expiração = agora + dias. */
function computeGrantDates(now, days) {
    return {
        startAt: now,
        expiresAt: new Date(now.getTime() + days * 86400000),
    };
}
/**
 * Extensão previsível: o novo vencimento parte de `max(vencimento atual, agora)`
 * + dias. Assim, estender não "rouba" o período já pago/concedido.
 */
function computeExtendedExpiry(currentExpiresAt, now, days) {
    const base = currentExpiresAt && currentExpiresAt.getTime() > now.getTime()
        ? currentExpiresAt
        : now;
    return new Date(base.getTime() + days * 86400000);
}
/**
 * Plano de referência (âncora) para o registro local. Acesso manual não é uma
 * compra — usamos o plano oficial mais próximo apenas como vínculo FK
 * obrigatório. A fonte de verdade da duração é `expiresAt`.
 */
function resolveAnchorPlanSlug(days) {
    if (days <= 7)
        return "semanal";
    if (days <= 45)
        return "mensal";
    return "anual";
}
