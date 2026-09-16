import { prisma } from "@/lib/db";

/**
 * Leitura de dados do Dashboard para TikTok a partir dos snapshots.
 * Nunca chama a API do TikTok — apenas lê o banco.
 * Valores indisponíveis → null (a UI decide como mostrar).
 */

export interface TikTokDashboardCard {
  label: string;
  value: number | null;
  changePercent: number | null;
  available: boolean;
}

export interface TikTokEvolutionPoint {
  label: string;
  capturedAt: string;
  followersCount?: number | null;
  videoCount?: number | null;
  likesCount?: number | null;
  /** Visualizações acumuladas da conta (coluna real do snapshot). */
  viewsCount?: number | null;
  /** Visitas ao perfil (coluna real do snapshot). */
  profileViews?: number | null;
}

export interface TikTokDashboardData {
  connected: boolean;
  username?: string | null;
  /** Nome de exibição da conta conectada (quando a plataforma devolve). */
  displayName?: string | null;
  /** Avatar real da conta conectada. null → a UI usa fallback. */
  avatarUrl?: string | null;
  followersCount?: number | null;
  videoCount?: number | null;
  lastSyncAt?: Date | null;
  snapshotCount: number;
  cards: {
    followers: TikTokDashboardCard;
    following: TikTokDashboardCard;
    likes: TikTokDashboardCard;
    videos: TikTokDashboardCard;
  };
  evolution: {
    "7d": TikTokEvolutionPoint[];
    "30d": TikTokEvolutionPoint[];
    "90d": TikTokEvolutionPoint[];
  };
  comparison: {
    weeklyGrowth: number | null;
    monthlyGrowth: number | null;
    followersGained7d: number | null;
    followersGained30d: number | null;
  };
  timeline: {
    biggestFollowerPeak: { date: string; value: number } | null;
    biggestDailyGain: { date: string; value: number } | null;
    biggestDailyLoss: { date: string; value: number } | null;
  };
}

function safePct(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  // undefined (optional chaining) e null são tratados igual:
  // métrica indisponível → null, NUNCA 0.
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getTikTokDashboardData(
  userId: string
): Promise<TikTokDashboardData> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "tiktok" },
  });

  const connected = connection?.status === "CONNECTED";

  const empty: TikTokDashboardData = {
    connected,
    username: connection?.username ?? null,
    displayName: null,
    avatarUrl: null,
    followersCount: null,
    videoCount: null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    snapshotCount: 0,
    cards: {
      followers: { label: "Seguidores", value: null, changePercent: null, available: false },
      following: { label: "Seguindo", value: null, changePercent: null, available: false },
      likes: { label: "Curtidas", value: null, changePercent: null, available: false },
      videos: { label: "Vídeos", value: null, changePercent: null, available: false },
    },
    evolution: { "7d": [], "30d": [], "90d": [] },
    comparison: {
      weeklyGrowth: null,
      monthlyGrowth: null,
      followersGained7d: null,
      followersGained30d: null,
    },
    timeline: {
      biggestFollowerPeak: null,
      biggestDailyGain: null,
      biggestDailyLoss: null,
    },
  };

  // Type guard real: garante que `connection` é não-nulo daqui em diante.
  if (!connection || connection.status !== "CONNECTED") return empty;

  const profile = await prisma.tikTokProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  // Mesma correção aplicada ao Instagram: a série é escopada ao PERFIL atual.
  // `where: { userId }` puro misturava snapshots de perfis diferentes na mesma
  // linha do tempo, produzindo um eixo Y sem escala coerente.
  const snapshots = await prisma.tikTokSnapshot.findMany({
    where: profile ? { userId, profileId: profile.id } : { userId },
    orderBy: { capturedAt: "asc" },
  });

  const latest = snapshots[snapshots.length - 1] ?? null;
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const now = Date.now();
  const recent7d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
  const recent30d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 30 * 864e5);
  const recent90d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 90 * 864e5);

  // Mesma correção do Instagram: os contadores vivem TAMBÉM em `TikTokProfile`
  // como colunas próprias. Quando o snapshot mais recente não trouxe o número,
  // o card mostrava "—" mesmo com o dado existindo no perfil sincronizado.
  // O fallback para o perfil JÁ existia em `followersCount`/`videoCount` logo
  // abaixo (e no caminho do Rank) — os cards eram os únicos fora da regra.
  // Dado ausente em TODAS as fontes continua null → "—", nunca zero inventado.
  const followersValue = latest?.followersCount ?? profile?.followersCount ?? null;
  const followingValue = latest?.followingCount ?? profile?.followingCount ?? null;
  const likesValue = latest?.likesCount ?? profile?.likesCount ?? null;
  const videosValue = latest?.videoCount ?? profile?.videoCount ?? null;

  const data: TikTokDashboardData = {
    ...empty,
    username: profile?.username ?? connection.username ?? null,
    // Foto e nome vêm do TikTokProfile (gravados na sincronização).
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    followersCount: followersValue,
    videoCount: videosValue,
    lastSyncAt: connection.lastSyncAt ?? null,
    snapshotCount: snapshots.length,
    cards: {
      followers: {
        label: "Seguidores",
        value: followersValue,
        changePercent: safePct(followersValue, previous?.followersCount),
        available: followersValue != null,
      },
      following: {
        label: "Seguindo",
        value: followingValue,
        changePercent: safePct(followingValue, previous?.followingCount),
        available: followingValue != null,
      },
      likes: {
        label: "Curtidas",
        value: likesValue,
        changePercent: safePct(likesValue, previous?.likesCount),
        available: likesValue != null,
      },
      videos: {
        label: "Vídeos",
        value: videosValue,
        changePercent: safePct(videosValue, previous?.videoCount),
        available: videosValue != null,
      },
    },
    evolution: {
      "7d": mapEvolution(recent7d),
      "30d": mapEvolution(recent30d),
      "90d": mapEvolution(recent90d),
    },
    comparison: computeComparison(snapshots),
    timeline: computeTimeline(snapshots),
  };

  return data;
}

function mapEvolution(
  snapshots: {
    capturedAt: Date;
    followersCount?: number | null;
    videoCount?: number | null;
    likesCount?: number | null;
    viewsCount?: number | null;
    profileViews?: number | null;
  }[]
): TikTokEvolutionPoint[] {
  return snapshots.map((s) => ({
    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
      s.capturedAt
    ),
    capturedAt: s.capturedAt.toISOString(),
    followersCount: s.followersCount ?? null,
    videoCount: s.videoCount ?? null,
    likesCount: s.likesCount ?? null,
    // Colunas que JÁ existiam no snapshot e não estavam sendo mapeadas para o
    // gráfico — ou seja, dado real no banco que a interface não mostrava.
    viewsCount: s.viewsCount ?? null,
    profileViews: s.profileViews ?? null,
  }));
}

function computeComparison(
  snapshots: { capturedAt: Date; followersCount?: number | null }[]
): TikTokDashboardData["comparison"] {
  const now = Date.now();
  const current = snapshots[snapshots.length - 1]?.followersCount ?? null;

  const weekAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 7 * 864e5);
  const monthAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 30 * 864e5);

  return {
    weeklyGrowth: safePct(current, weekAgo?.followersCount ?? null),
    monthlyGrowth: safePct(current, monthAgo?.followersCount ?? null),
    followersGained7d:
      current != null && weekAgo?.followersCount != null ? current - weekAgo.followersCount : null,
    followersGained30d:
      current != null && monthAgo?.followersCount != null ? current - monthAgo.followersCount : null,
  };
}

function computeTimeline(
  snapshots: { capturedAt: Date; followersCount?: number | null }[]
): TikTokDashboardData["timeline"] {
  if (snapshots.length < 2) {
    return { biggestFollowerPeak: null, biggestDailyGain: null, biggestDailyLoss: null };
  }

  let biggestFollowerPeak: { date: string; value: number } | null = null;
  let biggestDailyGain: { date: string; value: number } | null = null;
  let biggestDailyLoss: { date: string; value: number } | null = null;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].followersCount;
    const curr = snapshots[i].followersCount;
    if (prev == null || curr == null) continue;

    const diff = curr - prev;
    if (diff > 0 && (!biggestDailyGain || diff > biggestDailyGain.value)) {
      biggestDailyGain = { date: snapshots[i].capturedAt.toISOString(), value: diff };
    }
    if (diff < 0 && (!biggestDailyLoss || diff < biggestDailyLoss.value)) {
      biggestDailyLoss = { date: snapshots[i].capturedAt.toISOString(), value: diff };
    }
    if (curr > (biggestFollowerPeak?.value ?? -Infinity)) {
      biggestFollowerPeak = { date: snapshots[i].capturedAt.toISOString(), value: curr };
    }
  }

  return { biggestFollowerPeak, biggestDailyGain, biggestDailyLoss };
}
