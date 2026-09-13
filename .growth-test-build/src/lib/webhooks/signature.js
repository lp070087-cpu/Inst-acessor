"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.hmacHex = hmacHex;
const crypto_1 = require("crypto");
/**
 * VERIFICAÇÃO DE ORIGEM DE WEBHOOKS (Meta/Instagram e TikTok)
 * ===========================================================
 * Assinatura de payload no padrão da Meta:
 *   `sha256=<hex digest do HMAC-SHA256(chave=app_secret, mensagem=raw body)>`
 *
 * - Usa `timingSafeEqual` para evitar timing attacks.
 * - NUNCA loga a assinatura recebida/computada.
 */
function safeEqualHex(computed, provided) {
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(provided.toLowerCase(), "utf8");
    if (a.length !== b.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(a, b);
}
/**
 * Valida o header `X-Hub-Signature-256` (Meta) ou `X-Signature` (TikTok).
 * Retorna true se o payload veio mesmo da plataforma (app_secret correto).
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret)
        return false;
    // Meta envia: sha256=<hex>
    const expected = signatureHeader.startsWith("sha256=")
        ? signatureHeader.slice("sha256=".length)
        : signatureHeader;
    const computed = (0, crypto_1.createHmac)("sha256", secret).update(rawBody, "utf8").digest("hex");
    return safeEqualHex(computed, expected);
}
/**
 * Versão curta para quando a plataforma não envia assinatura e o webhook
 * depende apenas do verify token (challenge GET). Este helper não é usado
 * no fluxo POST assinado.
 */
function hmacHex(rawBody, secret) {
    return (0, crypto_1.createHmac)("sha256", secret).update(rawBody, "utf8").digest("hex");
}
