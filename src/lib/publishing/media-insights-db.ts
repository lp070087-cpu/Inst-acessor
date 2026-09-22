import { prisma } from "@/lib/db";
import {
  buildMediaInsights,
  type InsightTab,
  type InsightMetric,
} from "@/lib/publishing/media-insights";

/**
 * LEITURA REAL DOS INSIGHTS DE UMA PUBLICAÇÃO
 * ============================================
 * Junta o que já está no banco para UMA publicação específica:
 *   - `InstagramMedia`         → campos do nó da mídia
 *   - `InstagramMediaMetric`   → última linha de insights coletada
 *   - `InstagramComment`       → comentários REALMENTE persistidos
 *
 * NÃO chama a API da Meta. NÃO cria sincronização. NÃO escreve nada.
 * Ausência continua ausência: `null` atravessa a camada inteira até a UI.
 */

interface Delegate<T> {
  findFirst(args?: unknown): Promise<T | null>;
  count(args?: unknown): Promise<number>;
}

type MediaRow = {
  id: string;
  igMediaId: string;
  mediaType: string | null;
  mediaProductType: string | null;
  caption: string | null;
  permalink: string | null;
  timestamp: Date | null;
  likeCount: number | null;
  commentsCount: number | null;
};

type MetricRow = {
  reached: number | null;
  impressions: number | null;
  shares: number | null;
  saves: number | null;
  comments: number | null;
  likes: number | null;
  videoViews: number | null;
  videoViewTime: number | null;
};

export interface MediaInsightsPayload {
  found: boolean;
  media: {
    igMediaId: string;
    format: string;
    caption: string | null;
    permalink: string | null;
    timestamp: string | null;
  } | null;
  tabs: Record<InsightTab, InsightMetric[]> | null;
  measuredCount: number;
  totalCount: number;
  hasMissingInsights: boolean;
  /** `true` se existe alguma linha de insights coletada para esta mídia. */
  hasStoredMetrics: boolean;
  /** `null` = não foi possível ler (degrada); `0` = lido e não há nenhum. */
  storedCommentsCount: number | null;
}

const iso = (d: Date | null): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

async function safeCount(delegate: Delegate<unknown> | undefined, args?: unknown): Promise<number | null> {
  if (!delegate?.count) return null;
  try {
    return await delegate.count(args);
  } catch {
    return null;
  }
}

/**
 * @param igMediaId ID externo da mídia (o mesmo usado pela Meta na URL).
 * @returns `found: false` quando a publicação não pertence ao usuário.
 */
export async function getMediaInsights(
  userId: string,
  igMediaId: string
): Promise<MediaInsightsPayload> {
  const p = prisma as unknown as {
    instagramMedia?: Delegate<MediaRow>;
    instagramMediaMetric?: {
      findFirst(args?: unknown): Promise<MetricRow | null>;
    };
    instagramComment?: Delegate<unknown>;
  };

  const empty: MediaInsightsPayload = {
    found: false,
    media: null,
    tabs: null,
    measuredCount: 0,
    totalCount: 0,
    hasMissingInsights: false,
    hasStoredMetrics: false,
    storedCommentsCount: null,
  };

  let media: MediaRow | null = null;
  try {
    media = (await p.instagramMedia?.findFirst({
      // O `userId` no filtro é o controle de acesso: uma mídia de outro usuário
      // simplesmente não é encontrada, e a rota devolve 404 — nunca dado alheio.
      where: { userId, igMediaId },
      select: {
        id: true,
        igMediaId: true,
        mediaType: true,
        mediaProductType: true,
        caption: true,
        permalink: true,
        timestamp: true,
        likeCount: true,
        commentsCount: true,
      },
    })) ?? null;
  } catch {
    return empty;
  }

  if (!media) return empty;

  let metrics: MetricRow | null = null;
  try {
    metrics = (await p.instagramMediaMetric?.findFirst({
      where: { mediaId: media.id, userId },
      // Última linha coletada: as métricas são reescritas a cada sync, e a mais
      // recente é a única que reflete o estado atual.
      orderBy: { capturedAt: "desc" },
      select: {
        reached: true,
        impressions: true,
        shares: true,
        saves: true,
        comments: true,
        likes: true,
        videoViews: true,
        videoViewTime: true,
      },
    })) ?? null;
  } catch {
    metrics = null;
  }

  // `InstagramComment.mediaId` é a FK INTERNA (aponta para `InstagramMedia.id`),
  // NÃO o `igMediaId` da Meta. Filtrar pelo id externo nunca casava com nada e
  // a contagem de comentários importados aparecia sempre como 0. Mesmo defeito
  // que `listStoredComments` já evitava resolvendo o id interno primeiro.
  const storedCommentsCount = await safeCount(p.instagramComment, {
    where: { userId, mediaId: media.id },
  });

  const built = buildMediaInsights({
    igMediaId: media.igMediaId,
    mediaType: media.mediaType,
    mediaProductType: media.mediaProductType,
    caption: media.caption,
    permalink: media.permalink,
    timestamp: iso(media.timestamp),
    likeCount: media.likeCount,
    commentsCount: media.commentsCount,
    metrics,
    storedCommentsCount,
  });

  return {
    found: true,
    media: {
      igMediaId: media.igMediaId,
      format: built.header.format,
      caption: built.header.caption,
      permalink: built.header.permalink,
      timestamp: built.header.timestamp,
    },
    tabs: built.tabs,
    measuredCount: built.measuredCount,
    totalCount: built.totalCount,
    hasMissingInsights: built.hasMissingInsights,
    hasStoredMetrics: metrics != null,
    storedCommentsCount,
  };
}
