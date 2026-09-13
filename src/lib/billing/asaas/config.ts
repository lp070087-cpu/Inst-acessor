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

export const ASAAS_SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
export const ASAAS_PRODUCTION_URL = "https://api.asaas.com/v3";

export type AsaasEnvironment = "sandbox" | "production";

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export interface AsaasConfig {
  /** Chave de API (access_token). Vazia = não configurado. */
  apiKey: string;
  /** URL base do Asaas. */
  baseUrl: string;
  /** Ambiente (sandbox/produção). */
  environment: AsaasEnvironment;
  /** Token de validação do webhook. Vazia = webhook não configurado. */
  webhookToken: string;
  /** Meio de cobrança default. */
  billingType: AsaasBillingType;
}

function resolveEnvironment(): AsaasEnvironment {
  const raw = (process.env.ASAAS_ENV ?? "sandbox").trim().toLowerCase();
  return raw === "production" || raw === "prod" ? "production" : "sandbox";
}

function resolveBillingType(value: string | undefined): AsaasBillingType {
  const v = (value ?? "PIX").trim().toUpperCase();
  if (v === "BOLETO") return "BOLETO";
  if (v === "CREDIT_CARD") return "CREDIT_CARD";
  return "PIX";
}

/** Lê a configuração do Asaas a partir das env vars do servidor. */
export function getAsaasConfig(): AsaasConfig {
  const apiKey = (process.env.ASAAS_API_KEY ?? "").trim();
  const environment = resolveEnvironment();
  const baseUrl = (process.env.ASAAS_BASE_URL ?? "").trim() || (
    environment === "production" ? ASAAS_PRODUCTION_URL : ASAAS_SANDBOX_URL
  );

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    environment,
    webhookToken: (process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim(),
    billingType: resolveBillingType(process.env.ASAAS_BILLING_TYPE),
  };
}

/** Indica se a integração está configurada (chave presente). */
export function isAsaasConfigured(config = getAsaasConfig()): boolean {
  return Boolean(config.apiKey);
}

/** Rótulo legível do ambiente (sem revelar valores). */
export function asaasEnvironmentLabel(config = getAsaasConfig()): string {
  return config.environment === "production" ? "Produção" : "Sandbox";
}

/**
 * Valida o FORMATO do `authToken` do webhook conforme a regra oficial do Asaas:
 * 32 a 255 caracteres, sem espaços, e NUNCA igual à API Key.
 * Retorna `null` quando o token não está configurado (não é "inválido", é
 * "ausente" — quem trata isso é `webhookConfigured`).
 * Nunca recebe/devolve o valor do token: só o veredito.
 */
export function asaasWebhookTokenIssue(
  config = getAsaasConfig()
): "ausente" | "formato_invalido" | "igual_api_key" | "ok" {
  const token = config.webhookToken;
  if (!token) return "ausente";
  if (token.length < 32 || token.length > 255) return "formato_invalido";
  if (/\s/.test(token)) return "formato_invalido";
  if (config.apiKey && token === config.apiKey) return "igual_api_key";
  return "ok";
}

/**
 * Status resumido para o painel admin — NUNCA revela valores.
 * - "nao_configurado"   → sem ASAAS_API_KEY.
 * - "configurado"       → com chave (sandbox ou produção conforme base URL).
 * - "webhook_configurado" → ASAAS_WEBHOOK_TOKEN presente.
 * - `webhookTokenIssue` → veredito de FORMATO do token (nunca o valor).
 */
export function asaasStatus(): {
  configured: boolean;
  environment: AsaasEnvironment | null;
  label: string;
  webhookConfigured: boolean;
  webhookTokenIssue: "ausente" | "formato_invalido" | "igual_api_key" | "ok";
} {
  const cfg = getAsaasConfig();
  const configured = isAsaasConfigured(cfg);
  return {
    configured,
    environment: configured ? cfg.environment : null,
    label: configured ? asaasEnvironmentLabel(cfg) : "Não configurado",
    webhookConfigured: Boolean(cfg.webhookToken),
    webhookTokenIssue: asaasWebhookTokenIssue(cfg),
  };
}
