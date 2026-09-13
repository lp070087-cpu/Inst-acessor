"use strict";
/**
 * Classificação central de erros da integração com o Instagram (Meta).
 *
 * Regras:
 * - Nunca expõe token, secret ou detalhes internos ao cliente.
 * - Logs seguros: apenas código/tipo, nunca credenciais.
 * - Mapeia erros para mensagens amigáveis + HTTP status controlado.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntegrationError = classifyIntegrationError;
exports.toErrorParam = toErrorParam;
/** Erros de token inválido/expirado retornados pela Graph API. */
const INVALID_TOKEN_META_CODES = new Set([
    190, // OAuthException — sessão expirada/inválida
    "190",
    "SESSION_EXPIRED",
    "SESSION_INVALID",
    "TOKEN_INVALID",
    "ACCESS_TOKEN_EXPIRED",
]);
/**
 * Classifica um erro da API Meta/Instagram em uma informação segura.
 * `err` deve ser uma instância de InstagramApiError (ou similar).
 */
function classifyIntegrationError(err, metaCode) {
    // Timeout explícito da nossa camada fetch.
    if (isTimeoutError(err)) {
        return {
            code: "timeout",
            httpStatus: 504,
            userMessage: "A Meta demorou para responder. Tente novamente em instantes.",
        };
    }
    // Falha de rede sem resposta da Meta.
    if (isNetworkError(err)) {
        return {
            code: "network",
            httpStatus: 502,
            userMessage: "Não foi possível falar com o Instagram agora. Tente novamente.",
        };
    }
    const code = metaCode ?? err?.code;
    if (typeof code !== "undefined" && INVALID_TOKEN_META_CODES.has(code)) {
        return {
            code: "token_invalid",
            httpStatus: 401,
            userMessage: "O acesso ao Instagram expirou ou não é mais válido. Conecte novamente.",
            metaCode: code,
        };
    }
    // Erro de configuração do servidor.
    if (typeof code === "string" &&
        (code.includes("CONFIG") || code.includes("MISSING"))) {
        return {
            code: "missing_config",
            httpStatus: 500,
            userMessage: "A integração ainda não está configurada no servidor.",
            metaCode: code,
        };
    }
    return {
        code: "meta_error",
        httpStatus: 502,
        userMessage: "O Instagram retornou um erro. Tente novamente em instantes.",
        metaCode: code,
    };
}
function isTimeoutError(err) {
    return (err instanceof Error &&
        (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout")));
}
function isNetworkError(err) {
    if (err instanceof Error && err.message.toLowerCase().includes("rede"))
        return true;
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch"))
        return true;
    return false;
}
/** Mapeia um IntegrationErrorCode para o query param de erro da UI. */
function toErrorParam(code) {
    switch (code) {
        case "denied":
            return "denied";
        case "missing_code":
            return "missing_code";
        case "invalid_state":
            return "invalid_state";
        case "state_expired":
            return "state_expired";
        case "token_exchange":
            return "token_exchange";
        case "token_invalid":
        case "token_expired":
            return "token_invalid";
        case "not_compatible":
            return "not_compatible";
        case "account_fetch":
            return "account_fetch";
        case "missing_config":
            return "config";
        case "timeout":
        case "network":
        case "meta_error":
        case "server":
        default:
            return "server";
    }
}
