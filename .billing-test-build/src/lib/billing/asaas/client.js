"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asaasClient = exports.AsaasHttpError = exports.AsaasNotConfiguredError = exports.ASAAS_TIMEOUT_MS = exports.ASAAS_USER_AGENT = void 0;
exports.sanitizeAsaasPayload = sanitizeAsaasPayload;
const config_1 = require("./config");
/**
 * ASAAS — CLIENTE HTTP (server-only)
 * ===================================
 * Camada fina sobre `fetch` para a API v3 do Asaas.
 *
 * Regras:
 *   - NUNCA importar em client component (segredos do servidor).
 *   - Headers: `access_token`, `Content-Type: application/json`,
 *     `User-Agent` identificando o Inst Acessor.
 *   - Timeout em todas as chamadas.
 *   - Erros tipados (`AsaasHttpError`) com status HTTP + código/mensagem da API.
 *   - Respostas sanitizadas (campos sensíveis removidos) antes de retornar ao
 *     chamador — nunca inclui tokens/secrets.
 *   - NENHUMA credencial é logada.
 *
 * Nenhuma chamada real é feita quando `ASAAS_API_KEY` está ausente:
 * os métodos lançam `AsaasNotConfiguredError` (fail-closed).
 */
exports.ASAAS_USER_AGENT = "InstAcessor/1.0 (+SaaS de crescimento)";
exports.ASAAS_TIMEOUT_MS = 15000;
/** Erro lançado quando a API key não está configurada. */
class AsaasNotConfiguredError extends Error {
    constructor() {
        super("Integração Asaas não configurada no servidor.");
        this.name = "AsaasNotConfiguredError";
    }
}
exports.AsaasNotConfiguredError = AsaasNotConfiguredError;
/** Erro de HTTP tipado com status e corpo (sanitizado) da API. */
class AsaasHttpError extends Error {
    constructor(status, body) {
        const parsed = parseErrorBody(body);
        super(parsed.message);
        this.name = "AsaasHttpError";
        this.status = status;
        this.code = parsed.code;
        this.errors = parsed.errors;
    }
}
exports.AsaasHttpError = AsaasHttpError;
function parseErrorBody(body) {
    if (typeof body !== "object" || body === null) {
        return { message: "Erro desconhecido do Asaas.", code: null, errors: [] };
    }
    const obj = body;
    const errors = Array.isArray(obj.errors)
        ? obj.errors
        : [];
    const first = errors[0];
    return {
        message: first?.description ?? (typeof obj.message === "string" ? obj.message : "Erro desconhecido do Asaas."),
        code: first?.code ?? (typeof obj.code === "string" ? obj.code : null),
        errors,
    };
}
/** Remove chaves sensíveis conhecidas de um objeto (nunca logar tokens). */
function sanitizeAsaasPayload(value) {
    if (typeof value !== "object" || value === null)
        return value;
    if (Array.isArray(value))
        return value.map(sanitizeAsaasPayload);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (/token|secret|password|access_|apikey|api_key|authorization/i.test(k))
            continue;
        out[k] = typeof v === "object" && v !== null ? sanitizeAsaasPayload(v) : v;
    }
    return out;
}
async function request(opts) {
    const config = opts.config ?? (0, config_1.getAsaasConfig)();
    if (!opts.allowNoKey && !config.apiKey) {
        throw new AsaasNotConfiguredError();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), exports.ASAAS_TIMEOUT_MS);
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": exports.ASAAS_USER_AGENT,
    };
    if (config.apiKey)
        headers["access_token"] = config.apiKey;
    try {
        const res = await fetch(`${config.baseUrl}${opts.path}`, {
            method: opts.method ?? "GET",
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: controller.signal,
            cache: "no-store",
        });
        const text = await res.text();
        let body = null;
        if (text) {
            try {
                body = JSON.parse(text);
            }
            catch {
                body = text;
            }
        }
        if (!res.ok) {
            // NUNCA loga o corpo completo — apenas código/mensagem sanitizados.
            const err = new AsaasHttpError(res.status, body);
            console.error(`[asaas] http ${res.status} ${opts.method ?? "GET"} ${opts.path} code=${err.code ?? "-"}`);
            throw err;
        }
        return sanitizeAsaasPayload(body);
    }
    catch (err) {
        if (err instanceof AsaasNotConfiguredError || err instanceof AsaasHttpError)
            throw err;
        if (err instanceof Error && err.name === "AbortError") {
            throw new AsaasHttpError(504, { message: "Tempo esgotado na chamada ao Asaas." });
        }
        // Erro de rede (DNS/ECONN) — sem detalhes sensíveis.
        throw new AsaasHttpError(502, { message: "Falha de rede ao chamar o Asaas." });
    }
    finally {
        clearTimeout(timer);
    }
}
exports.asaasClient = {
    get: (path, config) => request({ method: "GET", path, config }),
    post: (path, body, config) => request({ method: "POST", path, body, config }),
    put: (path, body, config) => request({ method: "PUT", path, body, config }),
    del: (path, config) => request({ method: "DELETE", path, config }),
};
