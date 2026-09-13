"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIKTOK_DESC_LIMIT = exports.INSTAGRAM_CAPTION_LIMIT = void 0;
exports.isPublicMediaUrl = isPublicMediaUrl;
exports.isDataUrl = isDataUrl;
exports.extractMediaRefs = extractMediaRefs;
exports.isVideoMime = isVideoMime;
exports.trimToLimit = trimToLimit;
exports.buildCaption = buildCaption;
exports.instagramContainerKind = instagramContainerKind;
exports.buildInstagramContainers = buildInstagramContainers;
exports.buildTikTokPostBody = buildTikTokPostBody;
exports.mapTikTokStatus = mapTikTokStatus;
exports.mapInstagramStatus = mapInstagramStatus;
/** URL pública aceita pelas plataformas (http/https). */
function isPublicMediaUrl(url) {
    if (!url)
        return false;
    const trimmed = url.trim();
    return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}
/** Detecção de data URL (upload local do browser). */
function isDataUrl(url) {
    if (!url)
        return false;
    return url.trim().startsWith("data:");
}
function extractMediaRefs(payload) {
    const items = payload.mediaItems ?? [];
    const primary = payload.mediaUrl ?? "";
    const publicItems = items.filter((it) => isPublicMediaUrl(it.mediaUrl));
    const publicPrimary = isPublicMediaUrl(primary) ? primary.trim() : null;
    const hasLocalOnlyMedia = (primary.trim().length > 0 && !isPublicMediaUrl(primary)) ||
        items.some((it) => it.mediaUrl.trim().length > 0 && !isPublicMediaUrl(it.mediaUrl));
    const hasAnyMedia = primary.trim().length > 0 || items.some((it) => it.mediaUrl.trim().length > 0);
    return { publicPrimary, publicItems, hasLocalOnlyMedia, hasAnyMedia };
}
// ------------------------------------------------------------
// Tamanhos/limites — valores documentados publicamente pelas
// plataformas (não inventados). Usados apenas como guarda local.
// ------------------------------------------------------------
/** Instagram: limite da legenda (2200 caracteres). */
exports.INSTAGRAM_CAPTION_LIMIT = 2200;
/** TikTok: limite da descrição (2200 caracteres). */
exports.TIKTOK_DESC_LIMIT = 2200;
/** True se o MIME é de vídeo. */
function isVideoMime(mime) {
    return !!mime && mime.trim().startsWith("video/");
}
/** Corta o texto no limite oficial (nunca estoura a API). Preserva emojis. */
function trimToLimit(text, limit) {
    if (!text)
        return "";
    const chars = Array.from(text);
    return chars.length > limit ? chars.slice(0, limit).join("") : text;
}
/** Monta a legenda final (caption + hashtags) já no limite. */
function buildCaption(caption, hashtags, limit) {
    const base = (caption ?? "").trim();
    const tags = (hashtags ?? "").trim();
    if (!base)
        return trimToLimit(tags, limit);
    if (!tags)
        return trimToLimit(base, limit);
    return trimToLimit(`${base}\n\n${tags}`, limit);
}
/**
 * Mapeia o formato interno do produto para o media_type oficial da Graph API
 * do Instagram ao criar o container. "post" com mídia de vídeo → REELS;
 * "post" com imagem → IMAGE. "reel"/"video" → REELS. "story" → STORIES.
 * "carrossel" é tratado à parte (media_type=CAROUSEL com children).
 */
function instagramContainerKind(format, primaryMime) {
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
/**
 * Converte a mídia disponível em specs de container para a Graph API.
 * - Formato carrossel → N containers (is_carousel_item=true) e depois o
 *   container "pai" CAROUSEL (children separadas por vírgula).
 * - Post imagem → IMAGE (image_url).
 * - Reel/vídeo/story → REELS/STORIES (video_url ou image_url).
 */
function buildInstagramContainers(payload) {
    const { format, mediaUrl, mimeType, mediaItems } = payload;
    const items = (mediaItems ?? []).filter((it) => isPublicMediaUrl(it.mediaUrl));
    // Carrossel: cria containers filhos primeiro.
    if (format === "carrossel") {
        // Carrossel exige pelo menos 2 itens públicos — senão não monta.
        if (items.length < 2) {
            return { children: [], parent: null, needsMediaPublish: false };
        }
        const children = items.map((it, idx) => ({
            mediaType: "IMAGE",
            url: it.mediaUrl.trim(),
            isCarouselItem: true,
            kindLabel: `Item ${idx + 1} do carrossel`,
        }));
        const parent = {
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
    const spec = {
        mediaType: kind,
        url: primary,
        isCarouselItem: false,
        kindLabel: kind === "REELS" ? "Reel" : kind === "STORIES" ? "Story" : kind === "CAROUSEL" ? "Carrossel" : "Post",
    };
    return { children: [], parent: spec, needsMediaPublish: true };
}
/**
 * Monta o corpo da Content Posting API (video/init) do TikTok.
 * - `privacy_level`: PUBLIC_TO_EVERYONE é o padrão para postagens do produto.
 * - Mídia: apenas 1 vídeo com URL pública (foto/carrossel não é suportado).
 */
function buildTikTokPostBody(caption, mediaUrl) {
    return {
        post_info: {
            title: trimToLimit(caption, exports.TIKTOK_DESC_LIMIT),
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
function mapTikTokStatus(status) {
    const s = (status ?? "").toUpperCase();
    if (s === "PUBLISH_COMPLETE" || s === "PUBLISHED")
        return "LIVE";
    if (s === "FAILED")
        return "ERROR";
    if (s === "PROCESSING_UPLOAD" || s === "PROCESSING_DOWNLOAD")
        return "PROCESSING";
    if (!s)
        return "PROCESSING";
    return "PROCESSING";
}
/**
 * Mapeia o status_code oficial da Graph API do Instagram para o estado
 * interno. Apenas FINISHED é considerado LIVE.
 */
function mapInstagramStatus(statusCode) {
    const s = (statusCode ?? "").toUpperCase();
    if (s === "FINISHED")
        return "LIVE";
    if (s === "ERROR")
        return "ERROR";
    if (s === "EXPIRED")
        return "ERROR";
    if (s === "IN_PROGRESS" || s === "PUBLISHED")
        return "PROCESSING";
    if (!s)
        return "PROCESSING";
    return "PROCESSING";
}
