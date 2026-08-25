/**
 * Tipos da API do TikTok (TikTok Graph API / OAuth 2.0).
 * Refletem APENAS campos que a API realmente retorna.
 * Campos ausentes → null (nunca inventar).
 */

export interface TikTokTokenPayload {
  accessToken: string;
  expiresIn: number | null;
  refreshToken: string | null;
  openId: string;
  unionId?: string | null;
  scopes: string;
}

/** Resposta de /user/info/ (profile). */
export interface TikTokUserNode {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  bio_description?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
  is_verified?: boolean;
  is_under_age_18?: boolean;
}

/** Resposta de /video/list/ (vídeos autorizados). */
export interface TikTokVideoNode {
  id: string;
  title?: string;
  cover_image_url?: string;
  video_url?: string;
  embed_url?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  create_time?: number;
}

/** Dados normalizados para persistência. */
export interface TikTokSyncData {
  profile: {
    tiktokUserId: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    followersCount?: number | null;
    followingCount?: number | null;
    likesCount?: number | null;
    videoCount?: number | null;
  };
  videos: {
    id: string;
    title?: string | null;
    coverUrl?: string | null;
    videoUrl?: string | null;
    embedUrl?: string | null;
    likeCount?: number | null;
    commentCount?: number | null;
    shareCount?: number | null;
    playCount?: number | null;
    timestamp?: Date | null;
  }[];
}

/** Resumo seguro retornado pelo sync (nunca tokens). */
export interface TikTokSyncSummary {
  ok: boolean;
  syncedAt: string;
  profile: {
    username?: string | null;
    followersCount?: number | null;
    videoCount?: number | null;
  };
  videosSynced: number;
  snapshotId: string;
}
