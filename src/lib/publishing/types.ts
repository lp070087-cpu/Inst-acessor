/**
 * TIPOS CENTRAIS DO MOTOR DE PUBLICAÇÃO — Fase 7
 * ================================================
 * Contrato genérico compartilhado por fila, retry, adapters e UI.
 *
 * Princípios (ESCOPO-OFICIAL + Fase 7):
 * - PUBLICADO SÓ com confirmação real do provider (nunca por tempo).
 * - PROCESSANDO = tentativa real em andamento.
 * - FALHOU guarda motivo; erros são classificados de forma segura.
 * - NUNCA armazenar/logar tokens, secrets ou payloads sensíveis.
 */

export const PUBLISH_PLATFORMS = ["instagram", "tiktok"] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export const PUBLISH_FORMATS = ["post", "carrossel", "reel", "story", "video"] as const;
export type PublishFormat = (typeof PUBLISH_FORMATS)[number];

/** Estados da FILA de publicação (PublishQueue.status). */
export const QUEUE_STATUSES = [
  "AGENDADO",
  "PROCESSANDO",
  "PUBLICADO",
  "FALHOU",
  "CANCELADO",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** Classificação segura de erro (nunca contém segredos). */
export const PUBLISH_ERROR_CODES = [
  "RETRYABLE",
  "PERMANENT",
  "AUTH",
  "RATE_LIMIT",
  "VALIDATION",
  "INTEGRATION_NOT_CONFIGURED",
] as const;
export type PublishErrorCode = (typeof PUBLISH_ERROR_CODES)[number];

/** Máximo de tentativas automáticas por item da fila. */
export const MAX_AUTO_ATTEMPTS = 3;

// ------------------------------------------------------------
// Payload / resultado de publicação
// ------------------------------------------------------------

/**
 * Payload que um adapter recebe para publicar.
 * `contentId` referencia o PlannedContent. `mediaUrl` pode ser uma data URL
 * (upload local no browser) — o adapter real converteria isso em mídia
 * enviada à plataforma quando a integração existir.
 */
export interface PublishPayload {
  contentId: string;
  platform: string;
  format: string;
  caption: string;
  hashtags?: string;
  mediaUrl?: string;
  mediaCount?: number;
  /** MIME type da capa quando conhecido (image/jpeg, video/mp4...). */
  mimeType?: string;
  /** Mídias extras (carrossel) — cada item com url e mime. */
  mediaItems?: {
    mediaUrl: string;
    mimeType?: string;
    mediaType?: "image" | "video";
  }[];
}

export interface PublishResult {
  ok: boolean;
  /** id externo REAL retornado pela plataforma (nunca inventado). */
  externalId?: string;
  publishedAt?: string;
  /** Classificação segura quando falhou. */
  errorCode?: PublishErrorCode;
  /** Mensagem amigável/sanitizada quando falhou. */
  errorMessage?: string;
  /** Mensagem amigável quando não configurado. */
  reason?: string;
}

export interface PublishStatusQuery {
  contentId: string;
  platform: string;
  externalId?: string | null;
}

export interface PublishStatusResult {
  ok: boolean;
  /** Estado real do provider quando consultável, senão null. */
  status?: "LIVE" | "PROCESSING" | "ERROR" | "NOT_FOUND";
  externalId?: string;
  publishedAt?: string;
  errorCode?: PublishErrorCode;
  errorMessage?: string;
}

export interface PublishCancelQuery {
  contentId: string;
  platform: string;
  externalId?: string | null;
}

export interface PublishCancelResult {
  ok: boolean;
  reason?: string;
  errorCode?: PublishErrorCode;
  errorMessage?: string;
}

// ------------------------------------------------------------
// Contrato do adapter
// ------------------------------------------------------------

export interface PublishingAdapter {
  readonly name: string;
  /** Valida o payload localmente (sem rede) antes de enfileirar. */
  validate(payload: PublishPayload): PublishValidationResult;
  /** Executa a publicação real (ou retorna INTEGRATION_NOT_CONFIGURED). */
  publish(payload: PublishPayload): Promise<PublishResult>;
  /** Consulta o status real no provider quando disponível. */
  getStatus(query: PublishStatusQuery): Promise<PublishStatusResult>;
  /** Cancela uma publicação já enviada (opcional, formato-dependente). */
  cancel?(query: PublishCancelQuery): Promise<PublishCancelResult>;
}

export interface PublishValidationResult {
  valid: boolean;
  errors: string[];
}
