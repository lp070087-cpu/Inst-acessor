import { tiktokApiGet } from "./client";
import { TikTokApiError } from "./client";
import type { TikTokSyncData, TikTokUserNode, TikTokVideoNode } from "./types";

/**
 * Coleta e normalização das métricas do TikTok.
 * Usa APENAS os campos que a API realmente retorna.
 * Campos indisponíveis → null.
 */

/** Obtém informações do perfil do usuário autorizado. */
export async function getTikTokUser(
  accessToken: string,
  openId: string
): Promise<TikTokUserNode> {
  const data = await tiktokApiGet<{ data?: TikTokUserNode }>(
    "/user/info/",
    accessToken,
    { fields: "open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count,is_verified" }
  );

  // Valida a resposta: nunca devolver `{}` fingindo ser um nó válido.
  // `open_id` é obrigatório no tipo e é a âncora da conexão (externalAccountId).
  if (!data.data || typeof data.data.open_id !== "string") {
    throw new TikTokApiError(
      "A API do TikTok respondeu sem os dados mínimos do perfil (open_id).",
      "INVALID_USER_RESPONSE"
    );
  }

  return data.data;
}

/** Obtém a lista de vídeos autorizados do usuário. */
export async function getTikTokVideos(
  accessToken: string,
  openId: string,
  limit = 20
): Promise<TikTokVideoNode[]> {
  const data = await tiktokApiGet<{ data?: { videos?: TikTokVideoNode[] } }>(
    "/video/list/",
    accessToken,
    {
      fields: "id,title,cover_image_url,video_url,embed_url,like_count,comment_count,share_count,view_count,create_time",
      max_count: String(limit),
    }
  );
  return data.data?.videos ?? [];
}

/** Coleta completa normalizada para o sync. */
export async function collectTikTokData(
  accessToken: string,
  openId: string
): Promise<TikTokSyncData> {
  let user: TikTokUserNode;
  try {
    user = await getTikTokUser(accessToken, openId);
  } catch (err) {
    if (err instanceof TikTokApiError) {
      throw err; // erro real do perfil — não degrada (precisa do profile)
    }
    throw err;
  }

  let videos: TikTokVideoNode[] = [];
  try {
    videos = await getTikTokVideos(accessToken, openId);
  } catch (err) {
    // Vídeos podem não estar disponíveis (scope). Não derruba o sync.
    if (err instanceof TikTokApiError) {
      console.warn("[tiktok-metrics] vídeos indisponíveis", err.code ?? "n/a");
    } else {
      throw err;
    }
  }

  return {
    profile: {
      tiktokUserId: openId,
      username: user.display_name ?? null,
      displayName: user.display_name ?? null,
      avatarUrl: user.avatar_url ?? null,
      bio: user.bio_description ?? null,
      followersCount: user.follower_count ?? null,
      followingCount: user.following_count ?? null,
      likesCount: user.likes_count ?? null,
      videoCount: user.video_count ?? null,
    },
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title ?? null,
      coverUrl: v.cover_image_url ?? null,
      videoUrl: v.video_url ?? null,
      embedUrl: v.embed_url ?? null,
      likeCount: v.like_count ?? null,
      commentCount: v.comment_count ?? null,
      shareCount: v.share_count ?? null,
      playCount: v.view_count ?? null,
      timestamp: v.create_time ? new Date(v.create_time * 1000) : null,
    })),
  };
}
