/**
 * ADAPTER TIKTOK — Fase 7
 * ========================
 * Implementa o contrato `PublishingAdapter` para o TikTok.
 *
 * ATENÇÃO: publicação REAL ainda NÃO está habilitada. `publish()` retorna
 * `INTEGRATION_NOT_CONFIGURED`. Usa APENAS APIs oficiais — nada inventado.
 *
 * Formas (Parte 7): vídeo (Content Posting API quando disponível).
 * Foto/carrossel no TikTok = capability futura a confirmar com a
 * integração oficial — NÃO é afirmado aqui.
 *
 * Segurança: nunca retorna/loga tokens.
 */

import {
  publishError,
  toPublishError,
  friendlyMessage,
} from "../errors";
import type {
  PublishingAdapter,
  PublishPayload,
  PublishResult,
  PublishStatusResult,
  PublishCancelResult,
} from "../types";

/** Nomes de endpoints OFICIAIS do TikTok Content Posting API (referência). */
export const TIKTOK_CONTENT_POSTING_ENDPOINTS = {
  /** Iniciar upload de vídeo (direct post). */
  postVideo: "https://open.tiktokapis.com/v2/post/publish/video/init/",
  /** Consultar status do upload. */
  getStatus: "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
} as const;

export const tiktokAdapter: PublishingAdapter = {
  name: "tiktok",

  validate(payload: PublishPayload) {
    const errors: string[] = [];
    if (!payload.contentId) errors.push("contentId ausente");
    if (!payload.format) errors.push("formato ausente");
    if (!payload.caption || payload.caption.trim().length === 0)
      errors.push("Legenda ausente — adicione antes de publicar.");
    if (!payload.mediaUrl && (!payload.mediaItems || payload.mediaItems.length === 0))
      errors.push("Mídia ausente — adicione ao menos um vídeo.");
    // TikTok = vídeo. Capa de imagem é apenas preview interno.
    if (payload.mediaCount && payload.mediaCount > 1) {
      errors.push("O TikTok aceita 1 vídeo por publicação (carrossel não disponível).");
    }
    return { valid: errors.length === 0, errors };
  },

  async publish(_payload: PublishPayload): Promise<PublishResult> {
    try {
      return {
        ok: false,
        errorCode: "INTEGRATION_NOT_CONFIGURED",
        errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED"),
        reason: friendlyMessage("INTEGRATION_NOT_CONFIGURED"),
      };
    } catch (err) {
      const pe = toPublishError(err);
      return {
        ok: false,
        errorCode: pe.code,
        errorMessage: friendlyMessage(pe.code),
      };
    }
  },

  async getStatus(): Promise<PublishStatusResult> {
    return {
      ok: false,
      errorCode: "INTEGRATION_NOT_CONFIGURED",
      errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED"),
    };
  },

  async cancel(): Promise<PublishCancelResult> {
    return {
      ok: false,
      reason: "Cancelamento de publicação enviada não está disponível nesta fase.",
    };
  },
};

// Backward-compat (Fase 6): mantém o nome antigo.
export async function prepareTikTokPublish(
  payload: PublishPayload
): Promise<PublishResult> {
  return tiktokAdapter.publish(payload);
}

export { validatePublishPayload } from "../instagram";

export type { PublishPayload, PublishResult };
