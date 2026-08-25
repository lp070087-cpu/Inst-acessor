/**
 * Tipos da API do Instagram (Graph API da Meta).
 * Refletem APENAS campos que a API realmente retorna.
 * Campos ausentes → null (nunca inventar).
 */

export interface InstagramAccountInfo {
  id: string;
  username: string;
  name?: string;
  accountType: string;
  profilePictureUrl?: string;
}

export interface InstagramTokenPayload {
  accessToken: string;
  expiresAt: Date | null;
  scopes: string;
}

/** Resposta de /{ig-user-id} com métricas básicas do perfil. */
export interface InstagramUserNode {
  id: string;
  username?: string;
  name?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  biography?: string;
}

/** Métricas de período retornadas pelo insights da conta. */
export interface InstagramAccountInsights {
  reach?: number | null;
  impressions?: number | null;
  profile_views?: number | null;
  // Engajamento é derivado quando a API fornece os componentes.
}

export interface InstagramMediaNode {
  id: string;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL" | "STORY";
  permalink?: string;
  caption?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  media_url?: string;
  thumbnail_url?: string;
}

export interface InstagramMediaMetricNode {
  reached?: number | null;
  impressions?: number | null;
  shares?: number | null;
  saves?: number | null;
  comments?: number | null;
  likes?: number | null;
  video_views?: number | null;
  video_view_time?: number | null;
}

/** Snapshot normalizado para persistência. */
export interface InstagramSyncData {
  account: InstagramAccountInfo;
  profile: {
    username?: string | null;
    name?: string | null;
    followersCount?: number | null;
    followsCount?: number | null;
    mediaCount?: number | null;
    profilePictureUrl?: string | null;
    biography?: string | null;
  };
  insights: {
    reach?: number | null;
    impressions?: number | null;
    profileViews?: number | null;
  };
  medias: {
    id: string;
    mediaType?: string | null;
    permalink?: string | null;
    caption?: string | null;
    timestamp?: Date | null;
    likeCount?: number | null;
    commentsCount?: number | null;
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    metrics?: InstagramMediaMetricNode | null;
  }[];
}

/** Resumo retornado pelo sync (seguro — nunca tokens). */
export interface InstagramSyncSummary {
  ok: boolean;
  syncedAt: string;
  profile: {
    username?: string | null;
    followersCount?: number | null;
    mediaCount?: number | null;
  };
  insights: {
    reach?: number | null;
    impressions?: number | null;
    profileViews?: number | null;
  };
  mediaSynced: number;
  snapshotId: string;
}
