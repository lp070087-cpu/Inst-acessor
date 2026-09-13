"use strict";
/**
 * HTTP SEGURO PARA PUBLICAÇÃO REAL
 * =================================
 * Cliente fetch com timeout e retries controlados para as APIs oficiais.
 * NUNCA loga tokens/segredos — apenas códigos de erro seguros.
 *
 * Usado pelos adapters reais de Instagram (Graph API) e TikTok
 * (Content Posting API). Mesmo padrão dos clientes existentes
 * (`integrations/instagram/client.ts` e `integrations/tiktok/client.ts`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLISH_MAX_RETRIES = exports.PUBLISH_TIMEOUT_MS = exports.PublishHttpError = void 0;
exports.publishHttp = publishHttp;
const PUBLISH_TIMEOUT_MS = 20000;
exports.PUBLISH_TIMEOUT_MS = PUBLISH_TIMEOUT_MS;
const PUBLISH_MAX_RETRIES = 2;
exports.PUBLISH_MAX_RETRIES = PUBLISH_MAX_RETRIES;
const RETRY_BASE_DELAY_MS = 500;
/** Erro tipado da publicação real (sem segredos). */
class PublishHttpError extends Error {
    constructor(message, status, retryable, code) {
        super(message);
        this.name = "PublishHttpError";
        this.status = status;
        this.retryable = retryable;
        this.code = code;
    }
}
exports.PublishHttpError = PublishHttpError;
function timeoutSignal() {
    return AbortSignal.timeout(PUBLISH_TIMEOUT_MS);
}
function isAbort(error) {
    return (error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError"));
}
function isRetryableStatus(status) {
    return status === 429 || status >= 500;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Executa um fetch com timeout + retries para 429/5xx/network.
 * Retorna o corpo JSON (assume-se que as APIs respondem JSON).
 */
async function publishHttp(url, options = {}) {
    const { method = "GET", headers = {}, body, timeoutMs = PUBLISH_TIMEOUT_MS } = options;
    let lastError;
    for (let attempt = 0; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
        if (attempt > 0)
            await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        try {
            const res = await fetch(url, {
                method,
                headers,
                body,
                signal: timeoutMs === Infinity ? undefined : AbortSignal.timeout(timeoutMs),
            });
            const text = await res.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            }
            catch {
                data = null;
            }
            if (!res.ok) {
                // Erro HTTP: classifica retryável (429/5xx) ou permanente (4xx).
                const retryable = isRetryableStatus(res.status);
                const message = safeErrorText(data, res.status);
                if (retryable && attempt < PUBLISH_MAX_RETRIES) {
                    lastError = new PublishHttpError(message, res.status, true);
                    continue;
                }
                throw new PublishHttpError(message, res.status, retryable);
            }
            return data;
        }
        catch (error) {
            if (error instanceof PublishHttpError)
                throw error;
            // Timeout/rede → retryável.
            const transient = isAbort(error) || error instanceof TypeError;
            if (transient && attempt < PUBLISH_MAX_RETRIES) {
                lastError = new PublishHttpError("Falha de rede ao contactar a plataforma. Tente novamente.", 0, true, isAbort(error) ? "TIMEOUT" : "NETWORK");
                continue;
            }
            throw new PublishHttpError("Falha de rede ao contactar a plataforma. Tente novamente.", 0, false, isAbort(error) ? "TIMEOUT" : "NETWORK");
        }
    }
    throw lastError instanceof PublishHttpError
        ? lastError
        : new PublishHttpError("Falha ao contactar a plataforma.", 0, true);
}
/** Extrai uma mensagem de erro segura (nunca inclui token/query). */
function safeErrorText(data, status) {
    if (data && typeof data === "object") {
        const rec = data;
        const err = rec.error;
        const candidate = String(err?.message ?? rec.message ?? "");
        if (candidate && candidate.length < 200)
            return candidate;
    }
    return status >= 500 ? "A plataforma retornou um erro." : "A plataforma rejeitou a solicitação.";
}
