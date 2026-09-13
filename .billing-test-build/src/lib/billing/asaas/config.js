"use strict";
/**
 * ASAAS — CONFIGURAÇÃO (server-only)
 * ===================================
 * Lê as variáveis de ambiente do Asaas APENAS no servidor.
 *
 * NUNCA criar `NEXT_PUBLIC_ASAAS_*` nem expor valores ao client.
 * NUNCA logar a API key.
 *
 * Modo de operação:
 *   - `ASAAS_API_KEY` presente   → integração habilitada.
 *   - `ASAAS_BASE_URL`           → URL base. Vazia = usa padrão por ambiente
 *                                   (Sandbox `https://api-sandbox.asaas.com/v3`
 *                                   ou Produção `https://api.asaas.com/v3`).
 *   - `ASAAS_ENV`                → "sandbox" (default) | "production". Usado
 *                                   para escolher a URL padrão e o rótulo exibido.
 *   - `ASAAS_WEBHOOK_TOKEN`      → token validado no webhook (origem dos eventos).
 *   - `ASAAS_BILLING_TYPE`       → meio de cobrança default:
 *                                   "PIX" (default) | "BOLETO" | "CREDIT_CARD".
 *                                   Definido pela DONA conforme a conta Asaas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASAAS_PRODUCTION_URL = exports.ASAAS_SANDBOX_URL = void 0;
exports.getAsaasConfig = getAsaasConfig;
exports.isAsaasConfigured = isAsaasConfigured;
exports.asaasEnvironmentLabel = asaasEnvironmentLabel;
exports.asaasStatus = asaasStatus;
exports.ASAAS_SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
exports.ASAAS_PRODUCTION_URL = "https://api.asaas.com/v3";
function resolveEnvironment() {
    const raw = (process.env.ASAAS_ENV ?? "sandbox").trim().toLowerCase();
    return raw === "production" || raw === "prod" ? "production" : "sandbox";
}
function resolveBillingType(value) {
    const v = (value ?? "PIX").trim().toUpperCase();
    if (v === "BOLETO")
        return "BOLETO";
    if (v === "CREDIT_CARD")
        return "CREDIT_CARD";
    return "PIX";
}
/** Lê a configuração do Asaas a partir das env vars do servidor. */
function getAsaasConfig() {
    const apiKey = (process.env.ASAAS_API_KEY ?? "").trim();
    const environment = resolveEnvironment();
    const baseUrl = (process.env.ASAAS_BASE_URL ?? "").trim() || (environment === "production" ? exports.ASAAS_PRODUCTION_URL : exports.ASAAS_SANDBOX_URL);
    return {
        apiKey,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        environment,
        webhookToken: (process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim(),
        billingType: resolveBillingType(process.env.ASAAS_BILLING_TYPE),
    };
}
/** Indica se a integração está configurada (chave presente). */
function isAsaasConfigured(config = getAsaasConfig()) {
    return Boolean(config.apiKey);
}
/** Rótulo legível do ambiente (sem revelar valores). */
function asaasEnvironmentLabel(config = getAsaasConfig()) {
    return config.environment === "production" ? "Produção" : "Sandbox";
}
/**
 * Status resumido para o painel admin — NUNCA revela valores.
 * - "nao_configurado"   → sem ASAAS_API_KEY.
 * - "configurado"       → com chave (sandbox ou produção conforme base URL).
 * - "webhook_configurado" → ASAAS_WEBHOOK_TOKEN presente.
 */
function asaasStatus() {
    const cfg = getAsaasConfig();
    const configured = isAsaasConfigured(cfg);
    return {
        configured,
        environment: configured ? cfg.environment : null,
        label: configured ? asaasEnvironmentLabel(cfg) : "Não configurado",
        webhookConfigured: Boolean(cfg.webhookToken),
    };
}
