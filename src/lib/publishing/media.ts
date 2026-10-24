/**
 * MÍDIA PARA PUBLICAÇÃO REAL — Fase "Publicação Real"
 * =====================================================
 * Funções PURAS e determinísticas sobre o payload de publicação.
 * Separadas dos adapters para serem testáveis sem rede nem banco.
 *
 * Regra de honestidade (ESCOPO-OFICIAL):
 * - `SocialDraft.mediaUrl` é uma DATA URL (upload local, só na memória do
 *   browser). As APIs oficiais (Graph API `image_url`/`video_url` e TikTok
 *   `PULL_FROM_URL`) exigem uma URL PÚBLICA acessível pela internet.
 * - Se a mídia for local-only, a publicação REAL não pode acontecer ainda:
 *   o adapter deve retornar VALIDATION honesto — NUNCA inventar publicação.
 * - Nenhum id externo é fabricado: `externalId` só vem da confirmação real.
 */

/** URL pública aceita pelas plataformas (http/https). */
export function isPublicMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      (!parsed.port || parsed.port === "443") && host.includes(".") &&
      !/^[\d.]+$/.test(host) && !host.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host);
  } catch { return false; }
}

/** Detecção de data URL (upload local do browser). */
export function isDataUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.trim().startsWith("data:");
}

/**
 * Extrai as referências de mídia do payload e as classifica.
 * - `publicPrimary`: mídia principal pública (quando existir).
 * - `publicItems`: itens de carrossel com URL pública (quando existirem).
 * - `hasLocalOnlyMedia`: true se existir mídia apenas local (data URL).
 * - `hasAnyMedia`: true se houver alguma mídia (local ou pública).
 */
export interface MediaRefs {
  publicPrimary: string | null;
  publicItems: { mediaUrl: string; mimeType?: string; mediaType?: "image" | "video" }[];
  hasLocalOnlyMedia: boolean;
  hasAnyMedia: boolean;
}

export function extractMediaRefs(payload: {
  mediaUrl?: string;
  mediaItems?: { mediaUrl: string; mimeType?: string; mediaType?: "image" | "video" }[];
}): MediaRefs {
  const items = payload.mediaItems ?? [];
  const primary = payload.mediaUrl ?? "";

  const publicItems = items.filter((it) => isPublicMediaUrl(it.mediaUrl));
  const publicPrimary = isPublicMediaUrl(primary) ? primary.trim() : null;

  const hasLocalOnlyMedia =
    (primary.trim().length > 0 && !isPublicMediaUrl(primary)) ||
    items.some((it) => it.mediaUrl.trim().length > 0 && !isPublicMediaUrl(it.mediaUrl));

  const hasAnyMedia =
    primary.trim().length > 0 || items.some((it) => it.mediaUrl.trim().length > 0);

  return { publicPrimary, publicItems, hasLocalOnlyMedia, hasAnyMedia };
}

// ------------------------------------------------------------
// Tamanhos/limites — valores documentados publicamente pelas
// plataformas (não inventados). Usados apenas como guarda local.
// ------------------------------------------------------------

/** Instagram: limite da legenda (2200 caracteres). */
export const INSTAGRAM_CAPTION_LIMIT = 2200;
/** TikTok: limite da descrição (2200 caracteres). */
export const TIKTOK_DESC_LIMIT = 2200;

/** True se o MIME é de vídeo. */
export function isVideoMime(mime?: string | null): boolean {
  return !!mime && mime.trim().startsWith("video/");
}

/** Corta o texto no limite oficial (nunca estoura a API). Preserva emojis. */
export function trimToLimit(text: string, limit: number): string {
  if (!text) return "";
  const chars = Array.from(text);
  return chars.length > limit ? chars.slice(0, limit).join("") : text;
}

/** Monta a legenda final (caption + hashtags) já no limite. */
export function buildCaption(
  caption: string | undefined,
  hashtags: string | undefined,
  limit: number
): string {
  const base = (caption ?? "").trim();
  const tags = (hashtags ?? "").trim();
  if (!base) return trimToLimit(tags, limit);
  if (!tags) return trimToLimit(base, limit);
  return trimToLimit(`${base}\n\n${tags}`, limit);
}

// ------------------------------------------------------------
// Instagram — montagem dos corpos oficiais (puro, testável)
// ------------------------------------------------------------

export type InstagramContainerKind = "IMAGE" | "VIDEO" | "REELS" | "STORIES" | "CAROUSEL";

/**
 * Mapeia o formato interno do produto para o media_type oficial da Graph API
 * do Instagram ao criar o container. "post" com mídia de vídeo → REELS;
 * "post" com imagem → IMAGE. "reel"/"video" → REELS. "story" → STORIES.
 * "carrossel" é tratado à parte (media_type=CAROUSEL com children).
 */
export function instagramContainerKind(
  format: string,
  primaryMime?: string
): InstagramContainerKind {
  switch (format) {
    case "reel":
      return "REELS";
    case "video":
      return "REELS";
    case "story":
      return "STORIES";
    case "carrossel":
      return "CAROUSEL";
    case "post":
    default:
      return primaryMime?.startsWith("video/") ? "REELS" : "IMAGE";
  }
}

export interface InstagramContainerSpec {
  mediaType: InstagramContainerKind;
  url: string;
  isCarouselItem: boolean;
  /** label amigável usado em mensagens de erro. */
  kindLabel: string;
}

/**
 * Converte a mídia disponível em specs de container para a Graph API.
 * - Formato carrossel → N containers (is_carousel_item=true) e depois o
 *   container "pai" CAROUSEL (children separadas por vírgula).
 * - Post imagem → IMAGE (image_url).
 * - Reel/vídeo/story → REELS/STORIES (video_url ou image_url).
 */
export function buildInstagramContainers(payload: {
  format: string;
  mediaUrl?: string;
  mimeType?: string;
  mediaItems?: { mediaUrl: string; mimeType?: string; mediaType?: "image" | "video" }[];
}): {
  children: InstagramContainerSpec[];
  parent: InstagramContainerSpec | null;
  needsMediaPublish: boolean;
} {
  const { format, mediaUrl, mimeType, mediaItems } = payload;
  const items = (mediaItems ?? []).filter((it) => isPublicMediaUrl(it.mediaUrl));

  // Carrossel: cria containers filhos primeiro.
  if (format === "carrossel") {
    // Carrossel exige pelo menos 2 itens públicos — senão não monta.
    if (items.length < 2) {
      return { children: [], parent: null, needsMediaPublish: false };
    }
    const children = items.map((it, idx) => ({
      mediaType: "IMAGE" as const,
      url: it.mediaUrl.trim(),
      isCarouselItem: true,
      kindLabel: `Item ${idx + 1} do carrossel`,
    }));
    const parent: InstagramContainerSpec = {
      mediaType: "CAROUSEL",
      url: "", // montado depois com children=containerIds
      isCarouselItem: false,
      kindLabel: "Carrossel",
    };
    return { children, parent, needsMediaPublish: true };
  }

  // Mídia única.
  const primary = isPublicMediaUrl(mediaUrl ?? "")
    ? (mediaUrl ?? "").trim()
    : (items[0]?.mediaUrl.trim() ?? "");
  const primaryMime = mimeType ?? items[0]?.mimeType;
  const kind = instagramContainerKind(format, primaryMime);

  const spec: InstagramContainerSpec = {
    mediaType: kind,
    url: primary,
    isCarouselItem: false,
    kindLabel:
      kind === "REELS" ? "Reel" : kind === "STORIES" ? "Story" : kind === "CAROUSEL" ? "Carrossel" : "Post",
  };
  return { children: [], parent: spec, needsMediaPublish: true };
}

// ------------------------------------------------------------
// TikTok — montagem do corpo oficial (puro, testável)
// ------------------------------------------------------------

export interface TikTokPostRequestBody {
  post_info: { title: string; privacy_level: import("@/lib/integrations/tiktok/creator-info").TikTokPublishingOptions["privacy"]; disable_duet: boolean; disable_comment: boolean; disable_stitch: boolean;
    brand_content_toggle: boolean; brand_organic_toggle: boolean; is_aigc: boolean; video_cover_timestamp_ms?: number };
  source_info: { source: "PULL_FROM_URL"; video_url: string };
}

/**
 * Monta o corpo da Content Posting API (video/init) do TikTok.
 * - Metadata is explicit: the builder never chooses a privacy default.
 * - Mídia: apenas 1 vídeo com URL pública (foto/carrossel não é suportado).
 */
export function buildTikTokPostBody(
  caption: string,
  mediaUrl: string,
  options: import("@/lib/integrations/tiktok/creator-info").TikTokPublishingOptions,
  coverTimeMs?: number
): TikTokPostRequestBody {
  return {
    post_info: {
      title: trimToLimit(caption, TIKTOK_DESC_LIMIT),
      privacy_level: options.privacy,
      disable_duet: !options.allowDuet,
      disable_comment: !options.allowComment,
      disable_stitch: !options.allowStitch,
      brand_content_toggle: options.thirdPartyBrand,
      brand_organic_toggle: options.ownBrand,
      is_aigc: options.aiGenerated,
      ...(coverTimeMs !== undefined && Number.isSafeInteger(coverTimeMs) && coverTimeMs >= 0 && coverTimeMs < options.durationSec * 1000 ? { video_cover_timestamp_ms: coverTimeMs } : {}),
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: mediaUrl.trim(),
    },
  };
}

/**
 * Mapeia o status oficial da Content Posting API do TikTok para o estado
 * interno do motor de publicação.
 *   PUBLISH_COMPLETE / PUBLISHED → LIVE
 *   PROCESSING_* → PROCESSING
 *   FAILED → ERROR
 *   desconhecido → PROCESSING (nunca afirma LIVE sem confirmação)
 */
export function mapTikTokStatus(status: string | null | undefined): "LIVE" | "PROCESSING" | "ERROR" | "NOT_FOUND" {
  const s = (status ?? "").toUpperCase();
  if (s === "PUBLISH_COMPLETE" || s === "PUBLISHED") return "LIVE";
  if (s === "FAILED") return "ERROR";
  if (s === "PROCESSING_UPLOAD" || s === "PROCESSING_DOWNLOAD") return "PROCESSING";
  if (!s) return "PROCESSING";
  return "PROCESSING";
}

/** Official fetch-status envelope uses data.status, never data.state. */
export function readTikTokFetchStatus(response: unknown): "LIVE" | "PROCESSING" | "ERROR" {
  if (!response || typeof response !== "object") return "PROCESSING";
  const result = response as Record<string, unknown>;
  if (result.error && typeof result.error === "object") {
    const code = (result.error as Record<string, unknown>).code;
    if (code !== undefined && code !== "ok" && code !== 0) return "PROCESSING";
  }
  const data = result.data;
  if (!data || typeof data !== "object") return "PROCESSING";
  const status = (data as Record<string, unknown>).status;
  if (status === "PUBLISH_COMPLETE") return "LIVE";
  if (status === "FAILED") return "ERROR";
  return "PROCESSING";
}

/**
 * Mapeia o status_code oficial da Graph API do Instagram para o estado
 * interno. FINISHED significa pronto para publicar; somente PUBLISHED confirma
 * que o container foi publicado. O ID do container ainda não é o ID da mídia.
 */
export function mapInstagramStatus(
  statusCode: string | null | undefined
): "LIVE" | "PROCESSING" | "ERROR" | "NOT_FOUND" {
  const s = (statusCode ?? "").toUpperCase();
  if (s === "PUBLISHED") return "LIVE";
  if (s === "ERROR") return "ERROR";
  if (s === "EXPIRED") return "ERROR";
  if (s === "IN_PROGRESS" || s === "FINISHED") return "PROCESSING";
  if (!s) return "PROCESSING";
  return "PROCESSING";
}

/** Fail closed: a readable container is never evidence of a published media ID. */
export function verifiedInstagramMedia(data: unknown, mediaId: string, accountId: string): { externalId: string; publishedAt: string } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const owner = row.owner && typeof row.owner === "object" ? (row.owner as Record<string, unknown>).id : row.owner;
  if (row.id !== mediaId || owner !== accountId || row.status_code !== undefined
    || !["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(String(row.media_type))
    || typeof row.timestamp !== "string" || !Number.isFinite(Date.parse(row.timestamp))
    || typeof row.permalink !== "string") return null;
  try {
    const link = new URL(row.permalink);
    if (link.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(link.hostname) || link.username || link.password) return null;
  } catch { return null; }
  return { externalId: mediaId, publishedAt: new Date(row.timestamp).toISOString() };
}
