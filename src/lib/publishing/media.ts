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
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
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
  post_info: { title: string; privacy_level: "SELF_ONLY" | "PUBLIC_TO_EVERYONE"; disable_duet: boolean; disable_comment: boolean; disable_stitch: boolean };
  source_info: { source: "PULL_FROM_URL"; video_url: string };
}

/**
 * Monta o corpo da Content Posting API (video/init) do TikTok.
 * - `privacy_level`: PUBLIC_TO_EVERYONE é o padrão para postagens do produto.
 * - Mídia: apenas 1 vídeo com URL pública (foto/carrossel não é suportado).
 */
export function buildTikTokPostBody(
  caption: string,
  mediaUrl: string
): TikTokPostRequestBody {
  return {
    post_info: {
      title: trimToLimit(caption, TIKTOK_DESC_LIMIT),
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
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

/**
 * Mapeia o status_code oficial da Graph API do Instagram para o estado
 * interno. Apenas FINISHED é considerado LIVE.
 */
export function mapInstagramStatus(
  statusCode: string | null | undefined
): "LIVE" | "PROCESSING" | "ERROR" | "NOT_FOUND" {
  const s = (statusCode ?? "").toUpperCase();
  if (s === "FINISHED") return "LIVE";
  if (s === "ERROR") return "ERROR";
  if (s === "EXPIRED") return "ERROR";
  if (s === "IN_PROGRESS" || s === "PUBLISHED") return "PROCESSING";
  if (!s) return "PROCESSING";
  return "PROCESSING";
}
