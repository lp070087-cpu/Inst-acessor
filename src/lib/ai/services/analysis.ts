import { getDashboardInstagramData, type EvolutionPoint } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";

/**
 * Análise de Desempenho — 7/30/90 dias.
 * Lê APENAS os dados reais persistidos (snapshots). Nada é inventado.
 * Instagram e TikTok separados por seletor.
 */

export type AnalysisPeriod = "7d" | "30d" | "90d";
export type Platform = "instagram" | "tiktok";

export interface AnalysisMetric {
  key: string;
  label: string;
  value: number | null;
  changePercent: number | null;
  available: boolean;
}

export interface BestItem {
  label: string;
  date: string;
  value: number;
}

export interface AnalysisResult {
  platform: Platform;
  connected: boolean;
  username?: string | null;
  snapshotCount: number;
  lastSyncAt?: string | null;
  metrics: AnalysisMetric[];
  bestItems: BestItem[];
  evolution: EvolutionPoint[];
  periods: AnalysisPeriod[];
}

function iso(d: Date): string {
  return d.toISOString();
}

export async function runAnalysis(
  userId: string,
  platform: Platform,
  period: AnalysisPeriod
): Promise<AnalysisResult> {
  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);
    const metrics: AnalysisMetric[] = [
      {
        key: "followers",
        label: "Seguidores",
        value: d.followersCount ?? null,
        changePercent: d.cards.followers.changePercent,
        available: d.cards.followers.available,
      },
      {
        key: "growth",
        label: "Crescimento",
        value: d.comparison.monthlyGrowth != null ? Math.round(d.comparison.monthlyGrowth * 100) / 100 : null,
        changePercent: null,
        available: d.comparison.monthlyGrowth != null,
      },
      {
        key: "engagement",
        label: "Engajamento",
        value: d.cards.engagement.value ?? null,
        changePercent: d.cards.engagement.changePercent,
        available: d.cards.engagement.available,
      },
      {
        key: "reach",
        label: "Alcance",
        value: d.cards.reach.value ?? null,
        changePercent: d.cards.reach.changePercent,
        available: d.cards.reach.available,
      },
      {
        key: "impressions",
        label: "Impressões",
        value: d.cards.impressions.value ?? null,
        changePercent: d.cards.impressions.changePercent,
        available: d.cards.impressions.available,
      },
      {
        key: "frequency",
        label: "Publicações",
        value: d.mediaCount ?? null,
        changePercent: d.cards.media.changePercent,
        available: d.cards.media.available,
      },
    ];

    const bestItems: BestItem[] = [];
    if (d.timeline.bestReachDay) {
      bestItems.push({
        label: "Melhor dia de alcance",
        date: iso(new Date(d.timeline.bestReachDay.date)),
        value: d.timeline.bestReachDay.value,
      });
    }
    if (d.timeline.bestEngagementDay) {
      bestItems.push({
        label: "Melhor dia de engajamento",
        date: iso(new Date(d.timeline.bestEngagementDay.date)),
        value: d.timeline.bestEngagementDay.value,
      });
    }
    if (d.timeline.biggestFollowerPeak) {
      bestItems.push({
        label: "Pico de seguidores",
        date: iso(new Date(d.timeline.biggestFollowerPeak.date)),
        value: d.timeline.biggestFollowerPeak.value,
      });
    }
    if (d.timeline.biggestDailyGain) {
      bestItems.push({
        label: "Maior ganho diário",
        date: iso(new Date(d.timeline.biggestDailyGain.date)),
        value: d.timeline.biggestDailyGain.value,
      });
    }
    if (d.timeline.biggestDailyLoss) {
      bestItems.push({
        label: "Maior perda diária",
        date: iso(new Date(d.timeline.biggestDailyLoss.date)),
        value: d.timeline.biggestDailyLoss.value,
      });
    }

    return {
      platform,
      connected: d.connected,
      username: d.username ?? null,
      snapshotCount: d.snapshotCount,
      lastSyncAt: d.lastSyncAt ? iso(d.lastSyncAt) : null,
      metrics,
      bestItems,
      evolution: d.evolution[period],
      periods: ["7d", "30d", "90d"],
    };
  }

  // TikTok
  const d = await getTikTokDashboardData(userId);
  const metrics: AnalysisMetric[] = [
    {
      key: "followers",
      label: "Seguidores",
      value: d.followersCount ?? null,
      changePercent: d.cards.followers.changePercent,
      available: d.cards.followers.available,
    },
    {
      key: "growth",
      label: "Crescimento",
      value: d.comparison.monthlyGrowth != null ? Math.round(d.comparison.monthlyGrowth * 100) / 100 : null,
      changePercent: null,
      available: d.comparison.monthlyGrowth != null,
    },
    {
      key: "engagement",
      label: "Curtidas",
      value: d.cards.likes.value ?? null,
      changePercent: d.cards.likes.changePercent,
      available: d.cards.likes.available,
    },
    {
      key: "frequency",
      label: "Vídeos",
      value: d.videoCount ?? null,
      changePercent: d.cards.videos.changePercent,
      available: d.cards.videos.available,
    },
  ];

  const bestItems: BestItem[] = [];
  if (d.timeline.biggestFollowerPeak) {
    bestItems.push({
      label: "Pico de seguidores",
      date: iso(new Date(d.timeline.biggestFollowerPeak.date)),
      value: d.timeline.biggestFollowerPeak.value,
    });
  }
  if (d.timeline.biggestDailyGain) {
    bestItems.push({
      label: "Maior ganho diário",
      date: iso(new Date(d.timeline.biggestDailyGain.date)),
      value: d.timeline.biggestDailyGain.value,
    });
  }
  if (d.timeline.biggestDailyLoss) {
    bestItems.push({
      label: "Maior perda diária",
      date: iso(new Date(d.timeline.biggestDailyLoss.date)),
      value: d.timeline.biggestDailyLoss.value,
    });
  }

  return {
    platform,
    connected: d.connected,
    username: d.username ?? null,
    snapshotCount: d.snapshotCount,
    lastSyncAt: d.lastSyncAt ? iso(d.lastSyncAt) : null,
    metrics,
    bestItems,
    evolution: d.evolution[period],
    periods: ["7d", "30d", "90d"],
  };
}
