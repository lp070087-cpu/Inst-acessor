/**
 * Camada genérica de provider de IA — desacoplada.
 * Suporta OpenAI e Gemini. Sem mock: se nenhuma API key estiver configurada,
 * `aiConfigured()` retorna false; o ADMIN mostra "Configuração pendente" e as
 * páginas de cliente mostram estado controlado (sem valor fake).
 *
 * A configuração é CENTRAL (área admin, Fase 10): o DONO grava a chave via
 * `/api/admin/ia`, ela é persistida encriptada no banco (SystemSetting) e
 * passa a valer para o runtime. Se não houver chave no banco, cai para as
 * variáveis de ambiente (OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY).
 *
 * ⚠️ Estas funções rodam APENAS no servidor (route handlers / lib).
 * NUNCA importar este módulo em componentes client com API keys.
 * NUNCA expor chave no frontend.
 */

export type AIMessageInput = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface AICompletionOptions {
  messages: AIMessageInput[];
  /** Prompt de sistema complementar (contexto). */
  system?: string;
  /** Temperatura (0–2). Default por provider. */
  temperature?: number;
  maxTokens?: number;
}

/**
 * Códigos de falha do provider — camada única para tratamento controlado.
 * - "not_configured" → nenhuma chave/modelo disponível.
 * - "timeout"        → o provider não respondeu dentro do prazo.
 * - "rate_limit"     → 429 (muitas requisições / cota momentânea).
 * - "quota"          → 429 com insuficient_quota, ou 403 de cota.
 * - "auth"           → 401/403 (chave inválida) — NUNCA loga a chave.
 * - "http"           → qualquer outro erro HTTP do provider.
 */
export type AIProviderErrorCode =
  | "not_configured"
  | "timeout"
  | "rate_limit"
  | "quota"
  | "auth"
  | "http";

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly status?: number;

  constructor(code: AIProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Erro de IA não configurada — lançado pelas camadas de serviço quando
 * `getAIProvider()` retorna null. Classe ÚNICA (antes era definida 3× em
 * chat/copy/ideas). `instanceof AIConfiguredError` funciona em qualquer rota.
 */
export class AIConfiguredError extends Error {
  constructor() {
    super("IA_NAO_CONFIGURADA");
    this.name = "AIConfiguredError";
  }
}

/**
 * Aplica a mensagem amigável para o usuário a partir de um erro do provider.
 * Usada pelas rotas de IA para transformar `AIProviderError` em resposta HTTP
 * controlada (em vez de 500 genérico). NUNCA expõe chave/segredo.
 */
export function aiProviderErrorMessage(err: unknown): string {
  if (err instanceof AIConfiguredError) {
    return "A IA ainda não foi configurada. Fale com o suporte.";
  }
  if (err instanceof AIProviderError) {
    return err.message;
  }
  return "Não foi possível gerar a resposta. Tente novamente.";
}

/** Tempo máximo padrão de uma chamada ao provider (ms). */
export const AI_DEFAULT_TIMEOUT_MS = 45_000;

/**
 * fetch com timeout — aborta e lança `AIProviderError("timeout")` se o
 * provider não responder a tempo. Nunca expõe chave na mensagem.
 */
export async function aiFetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = AI_DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AIProviderError("timeout", "O provider de IA demorou para responder.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Converte o status HTTP de um provider em um AIProviderError controlado.
 * A mensagem nunca contém a chave nem o corpo completo da resposta.
 */
export function throwAIHTTPError(provider: string, status: number): never {
  if (status === 401 || status === 403) {
    throw new AIProviderError(
      "auth",
      `${provider} rejeitou a chave (${status}). Verifique a configuração.`,
      status
    );
  }
  if (status === 429) {
    throw new AIProviderError(
      "rate_limit",
      `${provider} está com limite de requisições (429). Tente novamente em instantes.`,
      status
    );
  }
  if (status === 402 || status === 404 || status === 409) {
    throw new AIProviderError(
      "quota",
      `${provider} retornou ${status}. Verifique cota/plano da conta.`,
      status
    );
  }
  throw new AIProviderError(
    "http",
    `${provider} retornou erro ${status}.`,
    status
  );
}

export interface AIProvider {
  readonly name: string;
  /** Completa um chat com o provider (sem tool calls). */
  complete(opts: AICompletionOptions): Promise<string>;
}

/**
 * Estado global "IA configurada?" — consulta a configuração admin (DB) e,
 * como fallback, as env vars. Server-only.
 */
export async function aiConfigured(): Promise<boolean> {
  const { resolveRuntimeAI } = await import("@/lib/admin/ai-config");
  const resolved = await resolveRuntimeAI();
  if (resolved) return true;
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY
  );
}
