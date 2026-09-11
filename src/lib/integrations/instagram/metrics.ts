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
 *
 * Fluxo Instagram Business Login: a conta autorizada É a conta profissional do
 * Instagram. Consultamos o nó `me` diretamente — NÃO existe (nem é necessário)
 * o caminho `me?fields=instagram_business_account`, que pertence ao fluxo de
 * Facebook Login com Página vinculada.
 */

/** Nó `me` do Instagram Business Login. */
interface InstagramMeNode {
  /** ID no escopo do app (usado para identificar a conta do usuário). */
  user_id?: string;
  /** ID do usuário do Instagram (usado nos endpoints de mídia/insights). */
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
}

/**
 * Obtém a conta Instagram autenticada + dados básicos do perfil.
 *
 * Campos solicitados (todos cobertos por `instagram_business_basic`):
 *   id, user_id, username, name, account_type, profile_picture_url
 *
 * O `account_type` vem da própria API (`BUSINESS`, `CREATOR` ou
 * `MEDIA_CREATOR`) — nunca é fixado em código.
 */
export async function getInstagramAccountInfo(
  accessToken: string
): Promise<InstagramAccountInfo> {
  const me = await graphGet<InstagramMeNode>(
    "me?fields=id,user_id,username,name,account_type,profile_picture_url",
    accessToken
  );

  if (!me.id) {
    throw new InstagramApiError(
      "A conta autorizada não retornou um perfil do Instagram válido.",
      "NOT_IG_BUSINESS"
    );
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
export function normalizeAccountType(raw: unknown): string {
  const value = typeof raw === "string" ? raw.toUpperCase().trim() : "";
  if (value === "BUSINESS") return "BUSINESS";
  if (value === "CREATOR") return "CREATOR";
  if (value === "MEDIA_CREATOR") return "CREATOR";
  return value || "PROFESSIONAL";
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
