import { prisma } from "@/lib/db";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { getLatestScore, getAIProfile, type Platform } from "@/lib/ai/services";
import { listGoals } from "@/lib/gamification";
import { listExperiments } from "@/lib/knowledge/experiments";
import { listInsights } from "@/lib/knowledge/patterns";
import { generateAlerts } from "@/lib/knowledge/alerts";
import { listPlannedContent } from "@/lib/planning";
import type { GrowthContext, PlatformContext, DataStatus } from "./types";

/**
 * CONTEXTO AGREGADO DE CRESCIMENTO — Fase 8 (Parte 3)
 * =====================================================
 * Fonte única de contexto para o Growth Engine. Reúne TODOS os dados reais já
 * persistidos: plataforma, nicho, objetivo, estágio, métricas, score, metas,
 * experimentos, conteúdos, insights, perfil de inteligência, diagnóstico.
 *
 * REGRA ABSOLUTA: nunca inventar dados. Quando um dado não existe ou está
 * desatualizado, o campo fica `null` / `DADO INSUFICIENTE` e a confiança
 * (0..1) reduz — jamais preenche com estimativa.
 */

/** Estágio derivado deterministicamente dos seguidores REAIS (INFERÊNCIA, não invenção). */
function deriveStage(followersIG: number | null, followersTT: number | null): string {
  const max = Math.max(followersIG ?? 0, followersTT ?? 0);
  if (max <= 0) return "sem-dados";
  if (max < 1000) return "inicio";
  if (max < 10000) return "crescimento";
  if (max < 100000) return "escala";
  return "autoridade";
}

/** Normaliza os dados de dashboard das duas plataformas para um shape único. */
async function loadPlatformData(userId: string, platform: Platform) {
  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);
    const first = d.evolution["30d"][0];
    const last = d.evolution["30d"][d.evolution["30d"].length - 1];
    const mediaFirst = typeof first?.mediaCount === "number" ? first.mediaCount : 0;
    const mediaLast = typeof last?.mediaCount === "number" ? last.mediaCount : 0;
    const days = last && first
      ? Math.max(1, (new Date(last.capturedAt).getTime() - new Date(first.capturedAt).getTime()) / 86400000)
      : 0;
    const diff = Math.max(0, mediaLast - mediaFirst);
    const frequency = days > 0 ? Math.round((diff / days) * 7 * 10) / 10 : null;

    return {
      platform,
      connected: d.connected,
      username: d.username ?? null,
      followersCount: d.followersCount ?? null,
      mediaCount: d.mediaCount ?? null,
      lastSyncAt: d.lastSyncAt ?? null,
      snapshotCount: d.snapshotCount,
      reach: d.cards.reach.value,
      impressions: d.cards.impressions.value,
      engagement: d.cards.engagement.value,
      cardsEngagementChange: d.cards.engagement.changePercent,
      cardsReachChange: d.cards.reach.changePercent,
      growth: d.comparison.monthlyGrowth,
      evolution30d: d.evolution["30d"],
      frequency,
      bestContent: d.timeline.bestReachDay
        ? [{ label: "Melhor dia de alcance", date: d.timeline.bestReachDay.date, value: d.timeline.bestReachDay.value }]
        : [],
      worstContent: d.timeline.biggestDailyLoss
        ? [{ label: "Maior perda diária", date: d.timeline.biggestDailyLoss.date, value: d.timeline.biggestDailyLoss.value }]
        : [],
    };
  }

  const d = await getTikTokDashboardData(userId);
  const first = d.evolution["30d"][0];
  const last = d.evolution["30d"][d.evolution["30d"].length - 1];
  const videosFirst = typeof first?.videoCount === "number" ? first.videoCount : 0;
  const videosLast = typeof last?.videoCount === "number" ? last.videoCount : 0;
  const days = last && first
    ? Math.max(1, (new Date(last.capturedAt).getTime() - new Date(first.capturedAt).getTime()) / 86400000)
    : 0;
  const diff = Math.max(0, videosLast - videosFirst);
  const frequency = days > 0 ? Math.round((diff / days) * 7 * 10) / 10 : null;

  return {
    platform,
    connected: d.connected,
    username: d.username ?? null,
    followersCount: d.followersCount ?? null,
    mediaCount: d.videoCount ?? null,
    lastSyncAt: d.lastSyncAt ?? null,
    snapshotCount: d.snapshotCount,
    reach: null, // TikTok não expõe alcance nas métricas persistidas
    impressions: null,
    engagement: null,
    cardsEngagementChange: null,
    cardsReachChange: null,
    growth: d.comparison.monthlyGrowth,
    evolution30d: d.evolution["30d"],
    frequency,
    bestContent: d.timeline.biggestFollowerPeak
      ? [{ label: "Pico de seguidores", date: d.timeline.biggestFollowerPeak.date, value: d.timeline.biggestFollowerPeak.value }]
      : [],
    worstContent: d.timeline.biggestDailyLoss
      ? [{ label: "Maior perda diária", date: d.timeline.biggestDailyLoss.date, value: d.timeline.biggestDailyLoss.value }]
      : [],
  };
}

/** Constrói o PlatformContext de uma plataforma a partir dos dados reais. */
async function buildPlatformContext(
  userId: string,
  platform: Platform
): Promise<PlatformContext> {
  const data = await loadPlatformData(userId, platform);

  // Estado de dados (Parte 23)
  let status: DataStatus;
  if (!data.connected) status = "SEM_REDE";
  else if (data.snapshotCount === 0) status = "SEM_SYNC";
  else if (data.snapshotCount < 2) status = "POUCOS_DADOS";
  else status = "DADOS_SUFICIENTES";

  // Score real mais recente
  const score = await getLatestScore(userId, platform);

  // Metas reais da plataforma
  const goals = await listGoals(userId);
  const goalsForPlatform = goals.filter(
    (g) => !g.platform || g.platform === platform
  );

  // Experimentos reais da plataforma
  const experiments = await listExperiments(userId);
  const experimentsForPlatform = experiments.filter(
    (e) => !e.platform || e.platform === platform
  );

  // Alertas reais
  const alerts = await generateAlerts(userId, platform);

  // Conteúdos planejados
  const planned = await listPlannedContent(userId, { platform });

  const publishedCount = planned.filter((c) => c.status === "PUBLICADO").length;

  return {
    platform,
    connected: data.connected,
    status,
    followers: data.followersCount,
    reach: data.reach,
    impressions: data.impressions,
    engagement: data.engagement,
    cardsEngagementChange: data.cardsEngagementChange,
    cardsReachChange: data.cardsReachChange,
    growth: data.growth,
    mediaCount: data.mediaCount,
    snapshotCount: data.snapshotCount,
    lastSyncAt: data.lastSyncAt ? data.lastSyncAt.toISOString() : null,
    posts: data.mediaCount,
    frequency: data.frequency,
    bestContent: data.bestContent,
    worstContent: data.worstContent,
    score: score?.overall ?? null,
    scoreCoverage: score?.coverage ?? null,
    goals: goalsForPlatform.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      progressPercent: g.progressPercent,
      status: g.status,
      deadline: g.deadline,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      platform: g.platform,
    })),
    experiments: experimentsForPlatform.map((e) => ({
      id: e.id,
      hypothesis: e.hypothesis,
      status: e.status,
      platform: e.platform ?? platform,
    })),
    alerts: alerts.map((a) => ({
      code: a.code,
      severity: a.severity,
      title: a.title,
    })),
    plannedContent: planned.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      scheduledAt: c.scheduledAt,
    })),
    publishedCount,
  };
}

/**
 * Monta o contexto completo de crescimento do usuário.
 * Todos os dados vêm de fontes reais. Ausência → null + confiança reduzida.
 */
export async function buildGrowthContext(userId: string): Promise<GrowthContext> {
  const [profile, instagram, tiktok, insights, intelligence] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    buildPlatformContext(userId, "instagram"),
    buildPlatformContext(userId, "tiktok"),
    Promise.all([listInsights(userId, "instagram"), listInsights(userId, "tiktok")]),
    getAIProfile(userId),
  ]);

  const stage = deriveStage(instagram.followers, tiktok.followers);

  // Confiança: começa em 1.0 e reduz por dado ausente. Determinístico.
  let confidence = 1.0;
  if (!(instagram.connected || tiktok.connected)) confidence *= 0.5;
  if (!(instagram.snapshotCount >= 2 || tiktok.snapshotCount >= 2)) confidence *= 0.5;
  if (!(instagram.score != null || tiktok.score != null)) confidence *= 0.5;
  if (profile?.objective == null) confidence *= 0.5;
  confidence = Math.round(Math.max(0.05, Math.min(1, confidence)) * 100) / 100;

  return {
    userId,
    userProfile: {
      objective: profile?.objective ?? null,
      niche: profile?.niche ?? null,
      displayName: profile?.displayName ?? null,
    },
    stage,
    instagram,
    tiktok,
    insights: [...insights[0], ...insights[1]].map((i) => ({
      id: i.id,
      type: i.type,
      summary: i.summary,
      platform: i.platform ?? null,
    })),
    intelligenceProfile: {
      summary: intelligence?.summary ?? null,
      preferredFormats: intelligence?.preferredFormats ?? null,
      postingFrequency: intelligence?.postingFrequency ?? null,
      observedPatterns: intelligence?.observedPatterns ?? null,
    },
    confidence,
    generatedAt: new Date().toISOString(),
  };
}
