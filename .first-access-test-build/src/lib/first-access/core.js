"use strict";
/**
 * PRIMEIRO ACESSO — NÚCLEO PURO (sem banco)
 * ===========================================
 * Regras de negócio isoladas para testes determinísticos
 * (`npm run first-access:test`), sem instanciar Prisma.
 *
 * Princípios (fase "Primeiro Acesso"):
 *   - A identidade inicial do acesso é o E-MAIL da compra (origem ASAAS) ou
 *     da liberação manual (origem ADMIN_MANUAL).
 *   - NUNCA criar senha automática/fixa/previsível; o cliente cria a própria.
 *   - Somente saber o e-mail NÃO é prova de posse → token de uso único.
 *   - Tokens: aleatórios, com expiração, uso único, nunca em logs, inválidos
 *     após uso. Não usar JWT eterno para ativação.
 *   - Não revelar informação sensível sobre contas (anti-enumeração).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_NOT_ELIGIBLE_MESSAGE = exports.FIRST_ACCESS_TOKEN_BYTES = exports.FIRST_ACCESS_TOKEN_TTL_MINUTES = exports.ACCESS_GRANT_STATUSES = void 0;
exports.normalizeEmail = normalizeEmail;
exports.isStrongPassword = isStrongPassword;
exports.effectiveGrantStatus = effectiveGrantStatus;
exports.isFirstAccessTokenUsable = isFirstAccessTokenUsable;
exports.generateRandomToken = generateRandomToken;
exports.hashToken = hashToken;
exports.isValidOrigin = isValidOrigin;
const node_crypto_1 = require("node:crypto");
/** Estados possíveis de um direito de acesso. */
exports.ACCESS_GRANT_STATUSES = [
    "PENDING_FIRST_ACCESS",
    "ACTIVE",
    "EXPIRED",
    "CANCELED",
];
/** Duração padrão de expiração do token de primeiro acesso (minutos). */
exports.FIRST_ACCESS_TOKEN_TTL_MINUTES = 60;
/** Número de caracteres do token aleatório (base64url). */
exports.FIRST_ACCESS_TOKEN_BYTES = 32;
/** Normaliza e-mail (trim + lowercase). Retorna null se inválido. */
function normalizeEmail(email) {
    const e = (email ?? "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
/** Valida força mínima de senha (alinhada ao cadastro: mín. 8). */
function isStrongPassword(password) {
    return typeof password === "string" && password.length >= 8;
}
/**
 * Calcula o status efetivo de um grant, considerando o tempo.
 * - CANCELED permanece CANCELED.
 * - Se não expira (null), o status persistido é o efetivo.
 * - Se expirou (now > expiresAt) → EXPIRED (independente do persistido).
 * - Se ainda dentro do período → status persistido (ACTIVE/PENDING_FIRST_ACCESS).
 */
function effectiveGrantStatus(persisted, expiresAt, now) {
    if (persisted === "CANCELED")
        return "CANCELED";
    const base = (persisted ?? "PENDING_FIRST_ACCESS");
    if (expiresAt && expiresAt.getTime() <= now.getTime())
        return "EXPIRED";
    return base;
}
/**
 * Verifica se o token de primeiro acesso ainda é válido.
 * - Já usado → inválido (replay).
 * - Expirado → inválido.
 * - Caso contrário, válido.
 */
function isFirstAccessTokenUsable(token, now) {
    if (token.consumed)
        return false;
    if (token.usedAt)
        return false;
    if (token.expiresAt.getTime() <= now.getTime())
        return false;
    return true;
}
/** Gera um token aleatório opaco (base64url, ~43 chars). */
function generateRandomToken() {
    return (0, node_crypto_1.randomBytes)(exports.FIRST_ACCESS_TOKEN_BYTES).toString("base64url");
}
/** Faz hash do token (SHA-256 hex) — NUNCA armazenar o token cru. */
function hashToken(token) {
    return (0, node_crypto_1.createHash)("sha256").update(token, "utf8").digest("hex");
}
/** Mensagem segura (anti-enumeração) para "e-mail sem acesso". */
exports.EMAIL_NOT_ELIGIBLE_MESSAGE = "Se houver uma liberação de acesso para este e-mail, enviaremos um link seguro.";
/**
 * Valida se o origin informado é permitido.
 */
function isValidOrigin(origin) {
    return (origin === "INFINITEPAY" ||
        origin === "ASAAS" ||
        origin === "ADMIN_MANUAL");
}
