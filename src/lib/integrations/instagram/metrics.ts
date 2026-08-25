import { graphGet } from "./client";
import { InstagramApiError } from "./client";
import type {
  InstagramAccountInfo,
  InstagramMediaMetricNode,
  InstagramMediaNode,
  InstagramSyncData,
  InstagramUserNode,
} from "./types";

/**
 * Coleta e normalização das métricas do Instagram.
 * Usa APENAS os campos que a API realmente retorna.
 * Campos indisponíveis → null.
 */

/** Obtém a conta Instagram + dados básicos do perfil. */
export async function getInstagramAccountInfo(
  accessToken: string
): Promise<InstagramAccountInfo> {
  const me = await graphGet<{ id: string; name?: string }>(
    "me?fields=id,name",
    accessToken
  );

  const withIg = await graphGet<{
    id: string;
    name?: string;
    instagram_business_account?: {
      id: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    };
  }>(
    `${me.id}?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}`,
    accessToken
  );

  const ig = withIg.instagram_business_account;

  if (!ig?.id) {
    throw new InstagramApiError(
      "A conta autorizada não tem um perfil profissional (Business/Creator) do Instagram compatível.",
      "NOT_IG_BUSINESS"
    );
  }

  return {
    id: ig.id,
    username: ig.username ?? "",
    name: ig.name ?? withIg.name,
    accountType: "BUSINESS",
    profilePictureUrl: ig.profile_picture_url,
  };
}

/** Obtém o perfil completo do usuário do Instagram. */
export async function getInstagramUser(
  igUserId: string,
  accessToken: string
): Promise<InstagramUserNode> {
  return graphGet<InstagramUserNode>(
    `${igUserId}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url,biography`,
    accessToken
  );
}

/**
 * Obtém insights da conta (janela configurável).
 * @param since timestamp inicial (opcional)
 */
export async function getAccountInsights(
  igUserId: string,
  accessToken: string,
  since?: number
): Promise<{ reach?: number | null; impressions?: number | null; profileViews?: number | null }> {
  // Período máximo suportado pela API é "30 days". Usamos janela de 7 dias
  // como padrão para os cards atuais (reach/impressions de 7 dias).
  const period = "day";
  const metric = "reach,impressions,profile_views";

  try {
    const data = await graphGet<{
      data?: { name?: string; period?: string; values?: { value?: number }[] }[];
    }>(
      `${igUserId}/insights?metric=${metric}&period=${period}${
        since ? `&since=${since}` : ""
      }`,
      accessToken
    );

    const result: { reach?: number | null; impressions?: number | null; profileViews?: number | null } = {
      reach: null,
      impressions: null,
      profileViews: null,
    };

    for (const item of data.data ?? []) {
      const values = item.values ?? [];
      const latest = values[values.length - 1]?.value;
      if (item.name === "reach") result.reach = latest ?? null;
      if (item.name === "impressions") result.impressions = latest ?? null;
      if (item.name === "profile_views") result.profileViews = latest ?? null;
    }

    return result;
  } catch (err) {
    // Insights podem não estar disponíveis (perm/staging). Não derruba o sync.
    if (err instanceof InstagramApiError) {
      console.warn("[instagram-metrics] insights indisponíveis", err.code ?? "n/a");
      return { reach: null, impressions: null, profileViews: null };
    }
    throw err;
  }
}

/** Obtém a lista de mídias recentes da conta. */
export async function getRecentMedia(
  igUserId: string,
  accessToken: string,
  limit = 50
): Promise<InstagramMediaNode[]> {
  const data = await graphGet<{ data: InstagramMediaNode[] }>(
    `${igUserId}/media?fields=id,media_type,permalink,caption,timestamp,like_count,comments_count,media_url,thumbnail_url&limit=${limit}`,
    accessToken
  );
  return data.data ?? [];
}

/** Obtém métricas detalhadas de uma mídia específica. */
export async function getMediaMetrics(
  mediaId: string,
  accessToken: string
): Promise<InstagramMediaMetricNode | null> {
  try {
    const data = await graphGet<InstagramMediaMetricNode & { id: string }>(
      `${mediaId}/insights?metric=reach,impressions,shares,saves,comments,likes,video_views,video_view_time`,
      accessToken
    );

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
  } catch (err) {
    // Nem toda mídia expõe insights. Não derruba o sync.
    if (err instanceof InstagramApiError) {
      console.warn(`[instagram-metrics] insights de mídia indisponíveis (${mediaId})`, err.code ?? "n/a");
      return null;
    }
    throw err;
  }
}

/** Coleta completa normalizada para o sync. */
export async function collectInstagramData(
  accessToken: string
): Promise<InstagramSyncData> {
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
