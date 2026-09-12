import { prisma } from "@/lib/db";

/**
 * Leitura de dados do Dashboard a partir dos snapshots persistidos.
 * NUNCA chama a API da Meta aqui — apenas lê o banco.
 * Valores indisponíveis → null (a UI decide como mostrar).
 */

export interface DashboardCard {
  label: string;
  value: number | null;
  /** Variação % em relação ao snapshot anterior (período comparado). */
  changePercent: number | null;
  available: boolean;
}

export interface EvolutionPoint {
  label: string;
  capturedAt: string;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
}

export interface DashboardInstagramData {
  connected: boolean;
  username?: string | null;
  /** Nome de exibição da conta conectada (quando a plataforma devolve). */
  displayName?: string | null;
  /** Avatar real da conta conectada. null → a UI usa fallback. */
  avatarUrl?: string | null;
  followersCount?: number | null;
  mediaCount?: number | null;
  lastSyncAt?: Date | null;
  /** Quantos snapshots existem (profundidade do histórico). */
  snapshotCount: number;
  cards: {
    followers: DashboardCard;
    engagement: DashboardCard;
    reach: DashboardCard;
    impressions: DashboardCard;
    profileViews: DashboardCard;
    media: DashboardCard;
  };
  /** Evolução 7/30/90 dias a partir dos snapshots. */
  evolution: {
    "7d": EvolutionPoint[];
    "30d": EvolutionPoint[];
    "90d": EvolutionPoint[];
  };
  /** Comparação de períodos. */
  comparison: {
    weeklyGrowth: number | null;
    monthlyGrowth: number | null;
    followersGained7d: number | null;
    followersGained30d: number | null;
    avgEngagement: number | null;
  };
  timeline: {
    bestReachDay: { date: string; value: number } | null;
    bestEngagementDay: { date: string; value: number } | null;
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

export async function getDashboardInstagramData(
  userId: string
): Promise<DashboardInstagramData> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
  });

  const connected = connection?.status === "CONNECTED";

  const empty: DashboardInstagramData = {
    connected,
    username: connection?.username ?? null,
    displayName: null,
    avatarUrl: null,
    followersCount: null,
    mediaCount: null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    snapshotCount: 0,
    cards: {
      followers: { label: "Seguidores", value: null, changePercent: null, available: false },
      engagement: { label: "Engajamento", value: null, changePercent: null, available: false },
      reach: { label: "Alcance", value: null, changePercent: null, available: false },
      impressions: { label: "Impressões", value: null, changePercent: null, available: false },
      profileViews: { label: "Visitas ao perfil", value: null, changePercent: null, available: false },
      media: { label: "Publicações", value: null, changePercent: null, available: false },
    },
    evolution: { "7d": [], "30d": [], "90d": [] },
    comparison: {
      weeklyGrowth: null,
      monthlyGrowth: null,
      followersGained7d: null,
      followersGained30d: null,
      avgEngagement: null,
    },
    timeline: {
      bestReachDay: null,
      bestEngagementDay: null,
      biggestFollowerPeak: null,
      biggestDailyGain: null,
      biggestDailyLoss: null,
    },
  };

  // Type guard real: garante que `connection` é não-nulo daqui em diante.
  if (!connection || connection.status !== "CONNECTED") return empty;

  const profile = await prisma.instagramProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  const snapshots = await prisma.instagramSnapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
  });

  const latest = snapshots[snapshots.length - 1] ?? null;
  // Snapshot imediatamente anterior → variação desde a última sincronização.
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const now = Date.now();
  const recent7d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 7 * 864e5);
  const recent30d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 30 * 864e5);
  const recent90d = snapshots.filter((s) => s.capturedAt.getTime() >= now - 90 * 864e5);

  const data: DashboardInstagramData = {
    ...empty,
    username: profile?.username ?? connection.username ?? null,
    // Foto e nome vêm do InstagramProfile (gravados na sincronização).
    displayName: profile?.name ?? null,
    avatarUrl: profile?.profilePictureUrl ?? null,
    followersCount: latest?.followersCount ?? profile?.followersCount ?? null,
    mediaCount: latest?.mediaCount ?? profile?.mediaCount ?? null,
    lastSyncAt: connection.lastSyncAt ?? null,
    snapshotCount: snapshots.length,
    cards: {
      followers: {
        label: "Seguidores",
        value: latest?.followersCount ?? null,
        changePercent: safePct(latest?.followersCount, previous?.followersCount),
        available: latest?.followersCount != null,
      },
      engagement: {
        label: "Engajamento",
        value: latest?.engagement ?? null,
        changePercent: safePct(latest?.engagement, previous?.engagement),
        available: latest?.engagement != null,
      },
      reach: {
        label: "Alcance",
        value: latest?.reach ?? null,
        changePercent: safePct(latest?.reach, previous?.reach),
        available: latest?.reach != null,
      },
      impressions: {
        label: "Impressões",
        value: latest?.impressions ?? null,
        changePercent: safePct(latest?.impressions, previous?.impressions),
        available: latest?.impressions != null,
      },
      profileViews: {
        label: "Visitas ao perfil",
        value: latest?.profileViews ?? null,
        changePercent: safePct(latest?.profileViews, previous?.profileViews),
        available: latest?.profileViews != null,
      },
      media: {
        label: "Publicações",
        value: latest?.mediaCount ?? null,
        changePercent: safePct(latest?.mediaCount, previous?.mediaCount),
        available: latest?.mediaCount != null,
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

function mapEvolution(snapshots: {
  capturedAt: Date;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
}[]): EvolutionPoint[] {
  return snapshots.map((s) => ({
    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(s.capturedAt),
    capturedAt: s.capturedAt.toISOString(),
    followersCount: s.followersCount ?? null,
    reach: s.reach ?? null,
    impressions: s.impressions ?? null,
    profileViews: s.profileViews ?? null,
    mediaCount: s.mediaCount ?? null,
  }));
}

function computeComparison(
  snapshots: {
    capturedAt: Date;
    followersCount?: number | null;
  }[]
): DashboardInstagramData["comparison"] {
  const now = Date.now();
  const current = snapshots[snapshots.length - 1]?.followersCount ?? null;

  // Snapshot ~7 dias atrás
  const weekAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 7 * 864e5);
  // Snapshot ~30 dias atrás
  const monthAgo = [...snapshots].reverse().find((s) => s.capturedAt.getTime() <= now - 30 * 864e5);

  return {
    weeklyGrowth: safePct(current, weekAgo?.followersCount ?? null),
    monthlyGrowth: safePct(current, monthAgo?.followersCount ?? null),
    followersGained7d: current != null && weekAgo?.followersCount != null
      ? current - weekAgo.followersCount
      : null,
    followersGained30d: current != null && monthAgo?.followersCount != null
      ? current - monthAgo.followersCount
      : null,
    avgEngagement: null, // apenas quando houver dados reais de engajamento
  };
}

function computeTimeline(
  snapshots: {
    capturedAt: Date;
    followersCount?: number | null;
    reach?: number | null;
  }[]
): DashboardInstagramData["timeline"] {
  if (snapshots.length < 2) {
    return {
      bestReachDay: null,
      bestEngagementDay: null,
      biggestFollowerPeak: null,
      biggestDailyGain: null,
      biggestDailyLoss: null,
    };
  }

  let bestReachDay: { date: string; value: number } | null = null;
  let bestEngagementDay: { date: string; value: number } | null = null;
  let biggestFollowerPeak: { date: string; value: number } | null = null;
  let biggestDailyGain: { date: string; value: number } | null = null;
  let biggestDailyLoss: { date: string; value: number } | null = null;

  for (const s of snapshots) {
    if (s.reach != null && (!bestReachDay || s.reach > bestReachDay.value)) {
      bestReachDay = { date: s.capturedAt.toISOString(), value: s.reach };
    }
  }

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

  return {
    bestReachDay,
    bestEngagementDay, // apenas quando houver dados reais
    biggestFollowerPeak,
    biggestDailyGain,
    biggestDailyLoss,
  };
}
