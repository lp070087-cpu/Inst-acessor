/**
 * ADAPTER INSTAGRAM — Fase 7
 * ===========================
 * Implementa o contrato `PublishingAdapter` para o Instagram (Meta).
 *
 * ATENÇÃO: publicação REAL ainda NÃO está habilitada. Quando o fluxo chegar
 * aqui, `publish()` retorna `INTEGRATION_NOT_CONFIGURED` (configuração
 * externa ausente). O código usa APENAS APIs oficiais da Meta — nenhum
 * endpoint inventado.
 *
 * Formas (Parte 6): post (imagem) · carrossel · reel (vídeo) · story.
 * A construção do payload real (container etc.) acontecerá quando a
 * integração for liberada — cada formato tem um fluxo oficial distinto.
 *
 * Segurança: nunca retorna/loga tokens. O acesso é feito via
 * SocialConnection.tokenEncrypted (descriptografado apenas no servidor).
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

/** Nomes de endpoints OFICIAIS do Instagram Graph API (referência apenas). */
export const INSTAGRAM_GRAPH_ENDPOINTS = {
  /** Container de publicação (imagem/carrossel/reel). */
  createContainer: "https://graph.facebook.com/v21.0/{ig-user-id}/media",
  /** Publicar container. */
  publishContainer: "https://graph.facebook.com/v21.0/{ig-user-id}/media_publish",
  /** Consultar status de publicação. */
  getContainer: "https://graph.facebook.com/v21.0/{container-id}",
} as const;

/**
 * Constrói o payload de publicação do Instagram a partir do conteúdo.
 * Na fase real, este método montaria o corpo oficial (image_url, video_url,
 * is_carousel_item, access_token etc.). Aqui permanece conceitual.
 */
export function buildInstagramPayload(payload: PublishPayload) {
  return {
    caption: payload.caption,
    hashtags: payload.hashtags,
    format: payload.format,
    mediaCount: payload.mediaCount,
  };
}

function notConfigured(message?: string): PublishResult {
  return {
    ok: false,
    errorCode: "INTEGRATION_NOT_CONFIGURED",
    errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED", message),
    reason: friendlyMessage("INTEGRATION_NOT_CONFIGURED", message),
  };
}

export const instagramAdapter: PublishingAdapter = {
  name: "instagram",

  validate(payload: PublishPayload) {
    const errors: string[] = [];
    if (!payload.contentId) errors.push("contentId ausente");
    if (!payload.format) errors.push("formato ausente");
    if (!payload.caption || payload.caption.trim().length === 0)
      errors.push("Legenda ausente — adicione antes de publicar.");
    if (!payload.mediaUrl && (!payload.mediaItems || payload.mediaItems.length === 0))
      errors.push("Mídia ausente — adicione ao menos uma imagem ou vídeo.");
    return { valid: errors.length === 0, errors };
  },

  async publish(_payload: PublishPayload): Promise<PublishResult> {
    try {
      // Publicação real ainda não configurada.
      return notConfigured(
        "A publicação no Instagram ainda não está configurada. Conecte sua conta quando a integração for liberada."
      );
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
    // Sem externalId real não há status a consultar.
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

// Backward-compat: a Fase 6 exportava `prepareInstagramPublish` e
// `validatePublishPayload`. Mantemos os nomes para não quebrar imports.
export async function prepareInstagramPublish(
  payload: PublishPayload
): Promise<PublishResult> {
  return instagramAdapter.publish(payload);
}

export function validatePublishPayload(payload: PublishPayload): string[] {
  return instagramAdapter.validate(payload).errors;
}

export type { PublishPayload, PublishResult };

// Re-export de erro utilitário (para consumidores antigos).
export { publishError };
