/**
 * ADAPTER INSTAGRAM — PUBLICAÇÃO REAL
 * ====================================
 * Implementa o contrato `PublishingAdapter` para o Instagram, usando a API
 * oficial em `graph.instagram.com` (fluxo Instagram Business Login — o app Meta
 * "Inst Acessor" foi criado com o caso de uso de Instagram, não Facebook Login).
 *
 * Requer o scope `instagram_business_content_publish`.
 *
 * Fluxo oficial (apenas quando há conexão + mídia pública):
 *   1) Criar container:   POST /{ig-user-id}/media
 *      - post imagem    → media_type=IMAGE, image_url, caption
 *      - carrossel      → N containers (is_carousel_item=true) + pai CAROUSEL
 *      - reel/vídeo     → media_type=REELS, video_url, caption
 *      - story          → media_type=STORIES, image_url/video_url (sem caption)
 *   2) Publicar:         POST /{ig-user-id}/media_publish  { creation_id }
 *      → retorna media id REAL (externalId — nunca inventado).
 *   3) Status:           GET /{container-id}?fields=status_code
 *
 * Fail-closed (regra de honestidade):
 *   - Sem conexão/config → INTEGRATION_NOT_CONFIGURED.
 *   - Mídia local-only (data URL do Preview) → VALIDATION honesto: a API
 *     exige URL pública. NUNCA fabrica id externo.
 *   - Erros de API → classificados (AUTH/RATE_LIMIT/RETRYABLE/PERMANENT).
 *
 * Segurança: token só no servidor; nunca loga/retorna credenciais.
 */

import { prisma } from "@/lib/db";
import { friendlyMessage, publishError, sanitizeMessage, toPublishError } from "../errors";
import type {
  PublishingAdapter,
  PublishPayload,
  PublishResult,
  PublishStatusResult,
  PublishStatusQuery,
  PublishCancelResult,
} from "../types";
import { publishHttp, PublishHttpError } from "../http";
import {
  buildCaption,
  buildInstagramContainers,
  extractMediaRefs,
  INSTAGRAM_CAPTION_LIMIT,
  isPublicMediaUrl,
  isVideoMime,
  mapInstagramStatus,
} from "../media";
import { resolvePublishConnection, type ConnectionResolution } from "../connection";

/**
 * Versão e host da API do Instagram.
 * Fluxo Instagram Business Login: os endpoints de publicação vivem em
 * `graph.instagram.com` (NÃO em `graph.facebook.com`), e o
 * `externalAccountId` guardado na conexão é o próprio IG user id devolvido
 * pelo nó `me` — sem Página do Facebook no caminho.
 */
const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v21.0";
const GRAPH_BASE = "https://graph.instagram.com";

/** Endpoints OFICIAIS usados na publicação do Instagram. */
export const INSTAGRAM_GRAPH_ENDPOINTS = {
  createContainer: `https://graph.instagram.com/${GRAPH_VERSION}/{ig-user-id}/media`,
  publishContainer: `https://graph.instagram.com/${GRAPH_VERSION}/{ig-user-id}/media_publish`,
  getContainer: `https://graph.instagram.com/${GRAPH_VERSION}/{container-id}`,
} as const;

function graphUrl(path: string): string {
  return `${GRAPH_BASE}/${GRAPH_VERSION}/${path}`;
}

/** Constrói a URL de um container (criação de mídia). */
function mediaUrl(igUserId: string): string {
  return graphUrl(`${igUserId}/media`);
}

/** URL de publicação de um container (confirmação). */
function mediaPublishUrl(igUserId: string): string {
  return graphUrl(`${igUserId}/media_publish`);
}

/** URL de consulta de status de um container. */
function containerStatusUrl(containerId: string): string {
  return graphUrl(`${containerId}?fields=status_code,id`);
}

/**
 * Opções de POST para a API do Instagram.
 * O formato oficial dos endpoints de mídia é `application/x-www-form-urlencoded`;
 * o `access_token` viaja no BODY (nunca na query, para não vazar em logs de URL).
 */
function formPost(form: Record<string, string>) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  } as const;
}

function connectionToCode(res: ConnectionResolution): PublishResult {
  if (res.ok) {
    // Guard interno: conexão OK não é erro — nunca chega aqui.
    return {
      ok: false,
      errorCode: "RETRYABLE",
      errorMessage: friendlyMessage("RETRYABLE"),
      reason: friendlyMessage("RETRYABLE"),
    };
  }
  switch (res.reason) {
    case "NO_CONNECTION":
      return notConfigured(
        "Conecte sua conta do Instagram em Redes Sociais para publicar de verdade."
      );
    case "NOT_CONNECTED":
      return notConfigured(
        "Sua conexão com o Instagram não está ativa. Reconecte em Redes Sociais."
      );
    case "DECRYPT_FAILED":
      return {
        ok: false,
        errorCode: "AUTH",
        errorMessage: "Não foi possível ler a credencial do Instagram. Reconecte sua conta.",
        reason: friendlyMessage("AUTH"),
      };
    case "NO_ACCOUNT":
      return notConfigured(
        "A conta do Instagram não foi identificada. Reconecte em Redes Sociais."
      );
  }
}

function notConfigured(message?: string): PublishResult {
  return {
    ok: false,
    errorCode: "INTEGRATION_NOT_CONFIGURED",
    errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED", message),
    reason: friendlyMessage("INTEGRATION_NOT_CONFIGURED", message),
  };
}

/**
 * Constrói o payload de publicação do Instagram a partir do conteúdo
 * (função pura — usada também em testes).
 */
export function buildInstagramPayload(payload: PublishPayload) {
  return {
    caption: buildCaption(payload.caption, payload.hashtags, INSTAGRAM_CAPTION_LIMIT),
    hashtags: payload.hashtags,
    format: payload.format,
    mediaCount: payload.mediaCount,
  };
}

// ------------------------------------------------------------
// Implementação real da publicação
// ------------------------------------------------------------

async function publishInstagram(payload: PublishPayload, userId: string): Promise<PublishResult> {
  // 1) Fail-closed: conexão ativa + token.
  const connection = await resolvePublishConnection(userId, "instagram");
  if (!connection.ok) return connectionToCode(connection);

  const { accessToken, externalAccountId } = connection;

  // 2) Valida mídia pública (regra de honestidade).
  const refs = extractMediaRefs(payload);
  if (!refs.hasAnyMedia) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage: "Adicione ao menos uma mídia antes de publicar.",
      reason: friendlyMessage("VALIDATION"),
    };
  }
  if (refs.hasLocalOnlyMedia && !refs.publicPrimary && refs.publicItems.length === 0) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage:
        "A mídia deste conteúdo é local (preview). A publicação real exige uma URL pública da imagem/vídeo.",
      reason: friendlyMessage("VALIDATION"),
    };
  }

  // 3) Monta containers oficiais.
  const { children, parent } = buildInstagramContainers(payload);
  if (!parent) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage: "Não foi possível montar a mídia para o formato escolhido.",
      reason: friendlyMessage("VALIDATION"),
    };
  }
  if (parent.mediaType === "CAROUSEL" && children.length < 2) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage: "O carrossel precisa de pelo menos 2 imagens com URL pública.",
      reason: friendlyMessage("VALIDATION"),
    };
  }

  const caption = buildCaption(payload.caption, payload.hashtags, INSTAGRAM_CAPTION_LIMIT);

  try {
    // 4a) Cria containers filhos (carrossel).
    const containerIds: string[] = [];
    for (const child of children) {
      const body: Record<string, string> = {
        image_url: child.url,
        is_carousel_item: "true",
        access_token: accessToken,
      };
      const created = await publishHttp<{ id?: string; error?: { message?: string } }>(
        mediaUrl(externalAccountId),
        formPost(body)
      );
      if (!created?.id) throw new PublishHttpError("Container não retornado pela API.", 0, false);
      containerIds.push(created.id);
    }

    // 4b) Cria o container (único ou pai do carrossel).
    let creationBody: Record<string, string> = { access_token: accessToken };
    if (parent.mediaType === "CAROUSEL") {
      creationBody.media_type = "CAROUSEL";
      creationBody.children = containerIds.join(",");
      creationBody.caption = caption;
    } else if (parent.mediaType === "STORIES") {
      creationBody.media_type = "STORIES";
      // Stories: image_url ou video_url (sem caption na API atual).
      creationBody[isVideoMime(payload.mimeType) ? "video_url" : "image_url"] = parent.url;
    } else {
      // IMAGE / REELS
      creationBody.media_type = parent.mediaType;
      if (parent.mediaType === "REELS") creationBody.video_url = parent.url;
      else creationBody.image_url = parent.url;
      creationBody.caption = caption;
    }

    const containerRes = await publishHttp<{ id?: string; error?: { message?: string } }>(
      mediaUrl(externalAccountId),
      formPost(creationBody)
    );
    const containerId = containerRes?.id;
    if (!containerId) {
      throw new PublishHttpError("Container não retornado pela API.", 0, false);
    }

    // 5) Publica o container (confirmação real).
    const published = await publishHttp<{ id?: string; error?: { message?: string } }>(
      mediaPublishUrl(externalAccountId),
      formPost({ creation_id: containerId, access_token: accessToken })
    );
    const mediaId = published?.id;
    if (!mediaId) {
      throw new PublishHttpError("Publicação não confirmada pela API.", 0, false);
    }

    // 6) Confirmação REAL → externalId.
    return { ok: true, externalId: mediaId, publishedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof PublishHttpError) {
      return classifyHttpError(err);
    }
    const pe = toPublishError(err);
    return { ok: false, errorCode: pe.code, errorMessage: friendlyMessage(pe.code) };
  }
}

/** Classifica um erro HTTP da Graph API em um código seguro. */
function classifyHttpError(err: PublishHttpError): PublishResult {
  if (err.status === 401 || err.status === 403) {
    return {
      ok: false,
      errorCode: "AUTH",
      errorMessage: "A conexão com o Instagram expirou ou não tem permissão. Reconecte sua conta.",
      reason: friendlyMessage("AUTH"),
    };
  }
  if (err.status === 429) {
    return {
      ok: false,
      errorCode: "RATE_LIMIT",
      errorMessage: friendlyMessage("RATE_LIMIT"),
      reason: friendlyMessage("RATE_LIMIT"),
    };
  }
  if (err.status >= 500) {
    return {
      ok: false,
      errorCode: "RETRYABLE",
      errorMessage: friendlyMessage("RETRYABLE"),
      reason: friendlyMessage("RETRYABLE"),
    };
  }
  if (err.status >= 400) {
    return {
      ok: false,
      errorCode: "PERMANENT",
      errorMessage: sanitizeMessage(err.message),
      reason: friendlyMessage("PERMANENT", sanitizeMessage(err.message)),
    };
  }
  // Rede/timeout sem status → retryável.
  return {
    ok: false,
    errorCode: "RETRYABLE",
    errorMessage: friendlyMessage("RETRYABLE"),
    reason: friendlyMessage("RETRYABLE"),
  };
}

async function getInstagramStatus(
  query: { contentId: string; platform: string; externalId?: string | null },
  userId: string
): Promise<PublishStatusResult> {
  const connection = await resolvePublishConnection(userId, "instagram");
  if (!connection.ok) {
    return { ok: false, errorCode: "INTEGRATION_NOT_CONFIGURED", errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED") };
  }
  if (!query.externalId) {
    return { ok: false, status: "PROCESSING" };
  }

  try {
    const data = await publishHttp<{ id?: string; status_code?: string; error?: { message?: string } }>(
      containerStatusUrl(query.externalId),
      { method: "GET" }
    );
    const status = mapInstagramStatus(data?.status_code);
    return { ok: status === "LIVE", status, externalId: data?.id ?? query.externalId };
  } catch (err) {
    if (err instanceof PublishHttpError) {
      // 404 = container não existe / expirado.
      if (err.status === 404) return { ok: false, status: "NOT_FOUND" };
      if (err.status === 401 || err.status === 403) {
        return { ok: false, errorCode: "AUTH", errorMessage: friendlyMessage("AUTH") };
      }
    }
    return { ok: false, status: "PROCESSING" };
  }
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

  async publish(payload: PublishPayload): Promise<PublishResult> {
    try {
      // Owner-check + credenciais: userId é derivado do conteúdo agendado.
      const content = (await prisma.plannedContent.findUnique({
        where: { id: payload.contentId },
        select: { userId: true },
      })) as unknown as { userId: string } | null;
      if (!content) {
        return { ok: false, errorCode: "VALIDATION", errorMessage: "Conteúdo não encontrado." };
      }
      return await publishInstagram(payload, content.userId);
    } catch (err) {
      const pe = toPublishError(err);
      return { ok: false, errorCode: pe.code, errorMessage: friendlyMessage(pe.code) };
    }
  },

  async getStatus(query: PublishStatusQuery): Promise<PublishStatusResult> {
    try {
      const content = (await prisma.plannedContent.findUnique({
        where: { id: query.contentId },
        select: { userId: true },
      })) as unknown as { userId: string } | null;
      if (!content) {
        return { ok: false, errorCode: "VALIDATION", errorMessage: "Conteúdo não encontrado." };
      }
      return await getInstagramStatus(query, content.userId);
    } catch (err) {
      const pe = toPublishError(err);
      return { ok: false, errorCode: pe.code, errorMessage: friendlyMessage(pe.code) };
    }
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

export { publishError };

export type { PublishPayload, PublishResult };
