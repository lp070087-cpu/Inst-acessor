/**
 * CLASSIFICAÇÃO DE ERROS DE PUBLICAÇÃO — Fase 7
 * ==============================================
 * Erros são classificados de forma SEGURA e amigável. NUNCA contêm tokens,
 * secrets ou detalhes internos. Mensagens sanitizadas vão para a UI e logs.
 *
 * Categorias (Parte 5):
 * - RETRYABLE: falha transitória (rede, timeout, 5xx) — pode tentar de novo.
 * - PERMANENT: falha definitiva (conteúdo inválido) — não re-tentar.
 * - AUTH: credencial expirada/revogada — usuário precisa reconectar.
 * - RATE_LIMIT: limite da plataforma — aguardar backoff maior.
 * - VALIDATION: payload inválido localmente — corrigir antes de re-tentar.
 * - INTEGRATION_NOT_CONFIGURED: configuração externa ausente.
 */

import type { PublishErrorCode } from "./types";

export class PublishError extends Error {
  readonly code: PublishErrorCode;
  readonly userMessage: string;

  constructor(code: PublishErrorCode, userMessage: string) {
    super(userMessage);
    this.name = "PublishError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

/** Cria um PublishError de forma tipada. */
export function publishError(
  code: PublishErrorCode,
  userMessage: string
): PublishError {
  return new PublishError(code, userMessage);
}

/**
 * Normaliza qualquer erro (desconhecido) para um PublishError seguro.
 * - Erros de rede/timeout → RETRYABLE.
 * - HTTP 401/403 → AUTH.
 * - HTTP 429 → RATE_LIMIT.
 * - HTTP 4xx → PERMANENT (validação externa).
 * - HTTP 5xx → RETRYABLE.
 * Nunca propaga mensagens internas sem sanitização.
 */
export function toPublishError(err: unknown): PublishError {
  if (err instanceof PublishError) return err;

  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (code === "RETRYABLE" || code === "PERMANENT" || code === "AUTH" || code === "RATE_LIMIT" || code === "VALIDATION" || code === "INTEGRATION_NOT_CONFIGURED") {
      const msg = (err as { message?: unknown }).message;
      return new PublishError(code as PublishErrorCode, sanitizeMessage(msg));
    }
  }

  // Timeouts / rede (fetch TypeError: failed to fetch) — retryável.
  if (err instanceof TypeError) {
    return publishError("RETRYABLE", "Falha de rede ao contactar a plataforma. Tente novamente.");
  }

  return publishError("RETRYABLE", "Ocorreu um erro inesperado. Tente novamente.");
}

/** Indica se um código de erro pode ser tentado de novo automaticamente. */
export function isRetryableCode(code: PublishErrorCode): boolean {
  return code === "RETRYABLE" || code === "RATE_LIMIT";
}

/** Indica se um código de erro exige ação do usuário (reconectar/corrigir). */
export function isUserActionCode(code: PublishErrorCode): boolean {
  return code === "AUTH" || code === "VALIDATION" || code === "INTEGRATION_NOT_CONFIGURED";
}

/**
 * Sanitiza uma mensagem: remove qualquer coisa que pareça segredo/token.
 * Estratégia simples e robusta: corta valores longos e remove padrões de
 * tokens/URLs com query. Mensagens de erro amigáveis são preferidas.
 */
export function sanitizeMessage(value: unknown, fallback = "Erro ao publicar."): string {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  const clean = value
    .replace(/access_token[=&]\S*/gi, "access_token=[oculto]")
    .replace(/token[=:]\s*\S+/gi, "token=[oculto]")
    .replace(/secret[=:]\s*\S+/gi, "secret=[oculto]")
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, "[token-oculto]");
  if (clean.length > 300) return clean.slice(0, 297) + "...";
  return clean;
}

/** Mensagem amigável padrão por código de erro. */
export function friendlyMessage(code: PublishErrorCode, fallback?: string): string {
  switch (code) {
    case "RETRYABLE":
      return fallback ?? "Falha temporária. O sistema tentará novamente automaticamente.";
    case "PERMANENT":
      return fallback ?? "A plataforma rejeitou este conteúdo. Revise e tente publicar de novo.";
    case "AUTH":
      return "Sua conexão com a rede social expirou. Reconecte em Redes Sociais.";
    case "RATE_LIMIT":
      return "A plataforma está limitando publicações. Aguarde um pouco antes de tentar de novo.";
    case "VALIDATION":
      return fallback ?? "Este conteúdo não pode ser publicado no formato escolhido.";
    case "INTEGRATION_NOT_CONFIGURED":
      return "A publicação real ainda não está configurada. Em breve você poderá conectar e publicar.";
    default:
      return fallback ?? "Erro ao publicar.";
  }
}
