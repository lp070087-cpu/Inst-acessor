/**
 * ADAPTER TIKTOK — PUBLICAÇÃO REAL
 * =================================
 * Implementa o contrato `PublishingAdapter` para o TikTok, usando a
 * Content Posting API oficial (direct post).
 *
 * Fluxo oficial (apenas quando há conexão + mídia pública):
 *   1) Iniciar post:   POST https://open.tiktokapis.com/v2/post/publish/video/init/
 *      - post_info.title, privacy_level=PUBLIC_TO_EVERYONE
 *      - source_info.source=PULL_FROM_URL, video_url (URL pública)
 *      - Authorization: Bearer <access_token>
 *      → retorna publish_id
 *   2) Consultar:      POST .../post/publish/status/fetch/  { publish_id }
 *      → status: PROCESSING_UPLOAD/DOWNLOAD | PUBLISH_COMPLETE | FAILED
 *
 * Fail-closed (regra de honestidade):
 *   - Sem conexão/config → INTEGRATION_NOT_CONFIGURED.
 *   - Mídia local-only (data URL do Preview) → VALIDATION honesto: a API
 *     exige URL pública. NUNCA fabrica id externo.
 *   - Foto/carrossel no TikTok = capability futura a confirmar; NÃO afirmada.
 *   - `PUBLISHED` SÓ após confirmação real (PUBLISH_COMPLETE).
 *
 * Segurança: token só no servidor; nunca loga/retorna credenciais.
 */

import { prisma } from "@/lib/db";
import { friendlyMessage, sanitizeMessage, toPublishError } from "../errors";
import type {
  PublishingAdapter,
  PublishPayload,
  PublishResult,
  PublishStatusResult,
  PublishStatusQuery,
  PublishCancelResult,
} from "../types";
import { publishHttp, PublishHttpError } from "../http";
import { buildTikTokPostBody, extractMediaRefs, isPublicMediaUrl, mapTikTokStatus } from "../media";
import { resolvePublishConnection, type ConnectionResolution } from "../connection";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

/** Nomes de endpoints OFICIAIS do TikTok Content Posting API. */
export const TIKTOK_CONTENT_POSTING_ENDPOINTS = {
  postVideo: "https://open.tiktokapis.com/v2/post/publish/video/init/",
  getStatus: "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
} as const;

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
        "Conecte sua conta do TikTok em Redes Sociais para publicar de verdade."
      );
    case "NOT_CONNECTED":
      return notConfigured(
        "Sua conexão com o TikTok não está ativa. Reconecte em Redes Sociais."
      );
    case "DECRYPT_FAILED":
      return {
        ok: false,
        errorCode: "AUTH",
        errorMessage: "Não foi possível ler a credencial do TikTok. Reconecte sua conta.",
        reason: friendlyMessage("AUTH"),
      };
    case "NO_ACCOUNT":
      return notConfigured(
        "A conta do TikTok não foi identificada. Reconecte em Redes Sociais."
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

function classifyHttpError(err: PublishHttpError): PublishResult {
  if (err.status === 401 || err.status === 403) {
    return {
      ok: false,
      errorCode: "AUTH",
      errorMessage: "A conexão com o TikTok expirou ou não tem permissão. Reconecte sua conta.",
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
  return {
    ok: false,
    errorCode: "RETRYABLE",
    errorMessage: friendlyMessage("RETRYABLE"),
    reason: friendlyMessage("RETRYABLE"),
  };
}

async function publishTikTok(payload: PublishPayload, userId: string): Promise<PublishResult> {
  // 1) Fail-closed: conexão ativa + token.
  const connection = await resolvePublishConnection(userId, "tiktok");
  if (!connection.ok) return connectionToCode(connection);

  const { accessToken, externalAccountId } = connection;

  // 2) Valida mídia pública (regra de honestidade).
  const refs = extractMediaRefs(payload);
  if (!refs.hasAnyMedia) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage: "Adicione um vídeo antes de publicar.",
      reason: friendlyMessage("VALIDATION"),
    };
  }
  const primaryPublic = isPublicMediaUrl(payload.mediaUrl ?? "")
    ? (payload.mediaUrl ?? "").trim()
    : refs.publicItems[0]?.mediaUrl;
  if (refs.hasLocalOnlyMedia && !primaryPublic) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage:
        "A mídia deste conteúdo é local (preview). A publicação real exige uma URL pública do vídeo.",
      reason: friendlyMessage("VALIDATION"),
    };
  }
  if (!primaryPublic) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      errorMessage: "Vídeo com URL pública é obrigatório para publicar no TikTok.",
      reason: friendlyMessage("VALIDATION"),
    };
  }

  // 3) Monta o corpo oficial e inicia o post.
  const body = buildTikTokPostBody(buildCaptionText(payload), primaryPublic);

  try {
    const init = await publishHttp<{
      data?: { publish_id?: string };
      error?: { code?: string | number; message?: string };
    }>(TIKTOK_CONTENT_POSTING_ENDPOINTS.postVideo, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const publishId = init?.data?.publish_id;
    if (!publishId) {
      throw new PublishHttpError("O TikTok não retornou publish_id.", 0, false);
    }

    // A publicação é ASSÍNCRONA: `publish_id` não confirma que o vídeo está
    // no ar. Consultamos o status oficial até a confirmação real
    // (PUBLISH_COMPLETE) ou desistimos com um erro retryável (guardando o
    // publish_id para a próxima tentativa não duplicar o post).
    const status = await pollTikTokStatus(accessToken, publishId);
    if (status === "LIVE") {
      return { ok: true, externalId: publishId, publishedAt: new Date().toISOString() };
    }
    if (status === "ERROR") {
      return {
        ok: false,
        errorCode: "PERMANENT",
        errorMessage: "O TikTok reprocessou o vídeo e falhou. Revise o arquivo e tente de novo.",
        reason: friendlyMessage("PERMANENT"),
        externalId: publishId,
      };
    }

    // Ainda processando → retryável (guardamos publish_id para não duplicar).
    return {
      ok: false,
      errorCode: "RETRYABLE",
      errorMessage: "O TikTok ainda está processando o vídeo. O sistema tentará de novo.",
      reason: friendlyMessage("RETRYABLE"),
      externalId: publishId,
    };
  } catch (err) {
    if (err instanceof PublishHttpError) return classifyHttpError(err);
    const pe = toPublishError(err);
    return { ok: false, errorCode: pe.code, errorMessage: friendlyMessage(pe.code) };
  }
}

/** Número máximo de consultas de status por publicação. */
const MAX_STATUS_POLLS = 5;
/** Intervalo entre consultas (ms). */
const STATUS_POLL_DELAY_MS = 4000;

/**
 * Consulta o status oficial do TikTok em loop curto até a confirmação.
 * Retorna "LIVE" | "PROCESSING" | "ERROR". Nunca afirma LIVE sem
 * PUBLISH_COMPLETE.
 */
async function pollTikTokStatus(
  accessToken: string,
  publishId: string
): Promise<"LIVE" | "PROCESSING" | "ERROR"> {
  for (let i = 0; i < MAX_STATUS_POLLS; i++) {
    const result = await publishHttp<{
      data?: { state?: string; publish_id?: string };
      error?: { code?: string | number; message?: string };
    }>(TIKTOK_CONTENT_POSTING_ENDPOINTS.getStatus, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const state = result?.data?.state ?? "";
    if (state === "PUBLISH_COMPLETE" || state === "PUBLISHED") return "LIVE";
    if (state === "FAILED") return "ERROR";
    // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / desconhecido → espera.
    if (i < MAX_STATUS_POLLS - 1) {
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_DELAY_MS));
    }
  }
  return "PROCESSING";
}

function buildCaptionText(payload: PublishPayload): string {
  const base = (payload.caption ?? "").trim();
  const tags = (payload.hashtags ?? "").trim();
  if (!base) return tags;
  if (!tags) return base;
  return `${base}\n\n${tags}`;
}

async function getTikTokStatus(
  query: { contentId: string; platform: string; externalId?: string | null },
  userId: string
): Promise<PublishStatusResult> {
  const connection = await resolvePublishConnection(userId, "tiktok");
  if (!connection.ok) {
    return { ok: false, errorCode: "INTEGRATION_NOT_CONFIGURED", errorMessage: friendlyMessage("INTEGRATION_NOT_CONFIGURED") };
  }
  if (!query.externalId) {
    return { ok: false, status: "PROCESSING" };
  }

  try {
    const result = await publishHttp<{
      data?: { state?: string; publish_id?: string };
      error?: { code?: string | number; message?: string };
    }>(TIKTOK_CONTENT_POSTING_ENDPOINTS.getStatus, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.accessToken}`,
      },
      body: JSON.stringify({ publish_id: query.externalId }),
    });

    const state = result?.data?.state;
    const status = mapTikTokStatus(state);
    return { ok: status === "LIVE", status, externalId: result?.data?.publish_id ?? query.externalId };
  } catch (err) {
    if (err instanceof PublishHttpError && (err.status === 401 || err.status === 403)) {
      return { ok: false, errorCode: "AUTH", errorMessage: friendlyMessage("AUTH") };
    }
    return { ok: false, status: "PROCESSING" };
  }
}

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

  async publish(payload: PublishPayload): Promise<PublishResult> {
    try {
      const content = (await prisma.plannedContent.findUnique({
        where: { id: payload.contentId },
        select: { userId: true },
      })) as unknown as { userId: string } | null;
      if (!content) {
        return { ok: false, errorCode: "VALIDATION", errorMessage: "Conteúdo não encontrado." };
      }
      return await publishTikTok(payload, content.userId);
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
      return await getTikTokStatus(query, content.userId);
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

// Backward-compat (Fase 6): mantém o nome antigo.
export async function prepareTikTokPublish(
  payload: PublishPayload
): Promise<PublishResult> {
  return tiktokAdapter.publish(payload);
}

export { validatePublishPayload } from "../instagram";

export type { PublishPayload, PublishResult };
