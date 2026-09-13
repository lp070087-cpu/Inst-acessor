"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstagramAccountInfo = getInstagramAccountInfo;
exports.normalizeAccountType = normalizeAccountType;
exports.getInstagramUser = getInstagramUser;
exports.getAccountInsights = getAccountInsights;
exports.getRecentMedia = getRecentMedia;
exports.getMediaMetrics = getMediaMetrics;
exports.collectInstagramData = collectInstagramData;
const client_1 = require("./client");
const client_2 = require("./client");
/**
 * Obtém a conta Instagram autenticada + dados básicos do perfil.
 *
 * Campos solicitados (todos cobertos por `instagram_business_basic`):
 *   id, user_id, username, name, account_type, profile_picture_url
 *
 * O `account_type` vem da própria API (`BUSINESS`, `CREATOR` ou
 * `MEDIA_CREATOR`) — nunca é fixado em código.
 */
async function getInstagramAccountInfo(accessToken) {
    const me = await (0, client_1.graphGet)("me?fields=id,user_id,username,name,account_type,profile_picture_url", accessToken);
    if (!me.id) {
        throw new client_2.InstagramApiError("A conta autorizada não retornou um perfil do Instagram válido.", "NOT_IG_BUSINESS");
    }
    return {
        id: me.id,
        username: me.username ?? "",
        name: me.name,
        accountType: normalizeAccountType(me.account_type),
        profilePictureUrl: me.profile_picture_url,
    };
}
/**
 * Normaliza o tipo de conta informado pela API.
 * A API pode devolver `BUSINESS`, `CREATOR` ou `MEDIA_CREATOR`. Valores
 * desconhecidos caem em `PROFESSIONAL` (descrição honesta: é uma conta
 * profissional, mas o tipo exato não foi informado).
 */
function normalizeAccountType(raw) {
    const value = typeof raw === "string" ? raw.toUpperCase().trim() : "";
    if (value === "BUSINESS")
        return "BUSINESS";
    if (value === "CREATOR")
        return "CREATOR";
    if (value === "MEDIA_CREATOR")
        return "CREATOR";
    return value || "PROFESSIONAL";
}
/** Obtém o perfil completo do usuário do Instagram. */
async function getInstagramUser(igUserId, accessToken) {
    return (0, client_1.graphGet)(`${igUserId}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url,biography`, accessToken);
}
/**
 * Obtém insights da conta (janela configurável).
 *
 * ⚠️ CONFIRMAÇÃO EXTERNA PENDENTE: a documentação oficial está bloqueada no
 * ambiente de desenvolvimento (egress allowlist). Os nomes de métrica abaixo
 * são os que já estavam em uso e são aceitos pela API do Instagram; o conjunto
 * exato disponível pode variar conforme a versão do Graph/Instagram API.
 * A chamada é DEGRADANTE por natureza (ver catch): métrica indisponível ou
 * recusada → `null`, sem derrubar o sync. Antes de depender destes números em
 * produção, confirme a lista vigente na documentação oficial do Instagram API.
 *
 * @param since timestamp inicial (opcional)
 */
async function getAccountInsights(igUserId, accessToken, since) {
    // Período máximo suportado pela API é "30 days". Usamos janela de 7 dias
    // como padrão para os cards atuais (reach/impressions de 7 dias).
    const period = "day";
    const metric = "reach,impressions,profile_views";
    try {
        const data = await (0, client_1.graphGet)(`${igUserId}/insights?metric=${metric}&period=${period}${since ? `&since=${since}` : ""}`, accessToken);
        const result = {
            reach: null,
            impressions: null,
            profileViews: null,
        };
        for (const item of data.data ?? []) {
            const values = item.values ?? [];
            const latest = values[values.length - 1]?.value;
            if (item.name === "reach")
                result.reach = latest ?? null;
            if (item.name === "impressions")
                result.impressions = latest ?? null;
            if (item.name === "profile_views")
                result.profileViews = latest ?? null;
        }
        return result;
    }
    catch (err) {
        // Insights podem não estar disponíveis (perm/staging). Não derruba o sync.
        if (err instanceof client_2.InstagramApiError) {
            console.warn("[instagram-metrics] insights indisponíveis", err.code ?? "n/a");
            return { reach: null, impressions: null, profileViews: null };
        }
        throw err;
    }
}
/** Obtém a lista de mídias recentes da conta. */
async function getRecentMedia(igUserId, accessToken, limit = 50) {
    const data = await (0, client_1.graphGet)(`${igUserId}/media?fields=id,media_type,permalink,caption,timestamp,like_count,comments_count,media_url,thumbnail_url&limit=${limit}`, accessToken);
    return data.data ?? [];
}
/** Obtém métricas detalhadas de uma mídia específica. */
async function getMediaMetrics(mediaId, accessToken) {
    try {
        const data = await (0, client_1.graphGet)(`${mediaId}/insights?metric=reach,impressions,shares,saves,comments,likes,video_views,video_view_time`, accessToken);
        return {
            reached: data.reached ?? null,
            impressions: data.impressions ?? null,
            shares: data.shares ?? null,
            saves: data.saves ?? null,
            comments: data.comments ?? null,
            likes: data.likes ?? null,
            video_views: data.video_views ?? null,
            video_view_time: data.video_view_time ?? null,
        };
    }
    catch (err) {
        // Nem toda mídia expõe insights. Não derruba o sync.
        if (err instanceof client_2.InstagramApiError) {
            console.warn(`[instagram-metrics] insights de mídia indisponíveis (${mediaId})`, err.code ?? "n/a");
            return null;
        }
        throw err;
    }
}
/** Coleta completa normalizada para o sync. */
async function collectInstagramData(accessToken) {
    const account = await getInstagramAccountInfo(accessToken);
    const user = await getInstagramUser(account.id, accessToken);
    const insights = await getAccountInsights(account.id, accessToken);
    const mediaNodes = await getRecentMedia(account.id, accessToken);
    // Busca métricas de cada mídia (limitado a 20 para não estourar rate limit).
    const medias = [];
    for (const node of mediaNodes.slice(0, 20)) {
        const metrics = await getMediaMetrics(node.id, accessToken);
        medias.push({
            id: node.id,
            mediaType: node.media_type ?? null,
            permalink: node.permalink ?? null,
            caption: node.caption ?? null,
            timestamp: node.timestamp ? new Date(node.timestamp) : null,
            likeCount: node.like_count ?? null,
            commentsCount: node.comments_count ?? null,
            mediaUrl: node.media_url ?? null,
            thumbnailUrl: node.thumbnail_url ?? null,
            metrics,
        });
    }
    return {
        account,
        profile: {
            username: user.username ?? null,
            name: user.name ?? null,
            followersCount: user.followers_count ?? null,
            followsCount: user.follows_count ?? null,
            mediaCount: user.media_count ?? null,
            profilePictureUrl: user.profile_picture_url ?? null,
            biography: user.biography ?? null,
        },
        insights,
        medias,
    };
}
