import { ai } from "@/lib/ai/db";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { GROWTH_SCORE_V1 } from "@/lib/knowledge";

/**
 * Score Inteligente (0–100) — FÓRMULA OFICIAL growth-score-v1.
 *
 * Regra oficial (Módulo 19, conteúdo da DONA):
 *   30% Engajamento · 25% Crescimento · 25% Alcance · 20% Consistência.
 *
 * - Explicável: cada pilar mostra valor e peso.
 * - Métrica indisponível NUNCA vira 0: o peso é redistribuído entre os
 *   pilares disponíveis e a cobertura (%) é documentada no resultado.
 * - Versionável: `version = "growth-score-v1"`.
 * - A nota é resumo da saúde, não gamificação vazia.
 */

export interface ScorePillar {
  key: string;
  label: string;
  value: number | null; // null = dado indisponível (NUNCA 0)
  available: boolean;
  /** Peso oficial da fórmula (soma 100 entre os 4 pilares oficiais). */
  weight: number;
  /** Pilares complementares (frequency/content) não pesam no overall. */
  complementary: boolean;
}

export interface ScoreFactors {
  positive: string[];
  attention: string[];
  unavailable: string[];
}

export interface ScoreResult {
  platform: "instagram" | "tiktok";
  overall: number | null;
  pillars: ScorePillar[];
  factors: ScoreFactors;
  /** Identificador da fórmula (versionável). */
  version: string;
  source: string;
  /** % dos dados cobertos pelos pilares disponíveis (0–100). */
  coverage: number | null;
  /** Pesos aplicados (growth-score-v1). */
  weighting: { engagement: number; growth: number; reach: number; consistency: number };
}

export type Platform = "instagram" | "tiktok";

interface SignalSource {
  followers: number | null;
  engagement: number | null;
  reach: number | null;
  media: number | null;
  snapshotCount: number;
  hasTwoPoints: boolean;
  periodGrowthPct: number | null;
}

// ------------------------------------------------------------
// Leitura de sinais reais
// ------------------------------------------------------------

async function signalsForPlatform(
  userId: string,
  platform: Platform
): Promise<SignalSource> {
  if (platform === "instagram") {
    const d = await getDashboardInstagramData(userId);
    return {
      followers: d.followersCount ?? null,
      engagement: d.cards.engagement.value ?? null,
      reach: d.cards.reach.value ?? null,
      media: d.mediaCount ?? null,
      snapshotCount: d.snapshotCount,
      hasTwoPoints: d.snapshotCount >= 2,
      periodGrowthPct: d.comparison.monthlyGrowth ?? null,
    };
  }

  const d = await getTikTokDashboardData(userId);
  return {
    followers: d.followersCount ?? null,
    engagement: d.cards.likes.value ?? null,
    reach: null,
    media: d.videoCount ?? null,
    snapshotCount: d.snapshotCount,
    hasTwoPoints: d.snapshotCount >= 2,
    periodGrowthPct: d.comparison.monthlyGrowth ?? null,
  };
}

// ------------------------------------------------------------
// Heurísticas determinísticas (explicáveis, sem inventar dados)
// ------------------------------------------------------------

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Normaliza crescimento mensal % em 0..1 (teto +100% considerado excelente). */
function growthScore(pct: number | null): number | null {
  if (pct == null) return null;
  return Math.round(clamp01(pct / 100) * 100);
}

/** Normaliza engajamento bruto em 0..1 (teto 10% do followers como referência relativa). */
function engagementScore(
  followers: number | null,
  engagement: number | null
): number | null {
  if (followers == null || followers === 0 || engagement == null) return null;
  const rate = engagement / followers;
  return Math.round(clamp01(rate / 0.1) * 100); // 10% = nota 100
}

/** Alcance relativo à base de seguidores. */
function reachScore(followers: number | null, reach: number | null): number | null {
  if (followers == null || followers === 0 || reach == null) return null;
  const rate = reach / followers;
  return Math.round(clamp01(rate / 2) * 100); // 2x base = nota 100
}

/** Consistência: frequência de sincronização + volume de dados. */
function consistencyScore(signal: SignalSource): number | null {
  if (signal.snapshotCount < 2) return null;
  return Math.min(50 + signal.snapshotCount * 5, 100);
}

/** Frequência: publicações quando disponíveis (complementar, não pesa). */
function frequencyScore(signal: SignalSource): number | null {
  if (signal.media == null || signal.media === 0) return null;
  return Math.round(clamp01(signal.media / 30) * 100);
}

/** Desempenho de conteúdo (complementar, não pesa). */
function contentScore(signal: SignalSource): number | null {
  if (!signal.hasTwoPoints) return null;
  const current = signal.engagement ?? signal.reach;
  if (current == null) return null;
  return Math.round(clamp01(current / 1000) * 100);
}

// ------------------------------------------------------------
// Cálculo principal — growth-score-v1
// ------------------------------------------------------------

export async function computeScore(userId: string, platform: Platform): Promise<ScoreResult> {
  const signal = await signalsForPlatform(userId, platform);
  const W = GROWTH_SCORE_V1;

  const pillars: ScorePillar[] = [
    {
      key: "engagement",
      label: "Engajamento",
      value: engagementScore(signal.followers, signal.engagement),
      available: signal.engagement != null,
      weight: W.engagement,
      complementary: false,
    },
    {
      key: "growth",
      label: "Crescimento",
      value: growthScore(signal.periodGrowthPct),
      available: signal.periodGrowthPct != null,
      weight: W.growth,
      complementary: false,
    },
    {
      key: "reach",
      label: "Alcance",
      value: reachScore(signal.followers, signal.reach),
      available: signal.reach != null,
      weight: W.reach,
      complementary: false,
    },
    {
      key: "consistency",
      label: "Consistência",
      value: consistencyScore(signal),
      available: signal.snapshotCount >= 2,
      weight: W.consistency,
      complementary: false,
    },
    // Complementares (não pesam no overall; ainda informam quando disponíveis)
    {
      key: "frequency",
      label: "Frequência",
      value: frequencyScore(signal),
      available: signal.media != null,
      weight: 0,
      complementary: true,
    },
    {
      key: "content",
      label: "Desempenho",
      value: contentScore(signal),
      available: signal.hasTwoPoints,
      weight: 0,
      complementary: true,
    },
  ];

  // Pilares oficiais disponíveis (não complementares)
  const weighted = pillars.filter((p) => !p.complementary);
  const available = weighted.filter((p) => p.available);

  // Cobertura: soma dos pesos dos pilares oficiais disponíveis / 100
  const totalWeight = weighted.reduce((acc, p) => acc + p.weight, 0); // deve ser 100
  const coveredWeight = available.reduce((acc, p) => acc + p.weight, 0);
  const coverage =
    available.length > 0 ? Math.round((coveredWeight / totalWeight) * 100) : null;

  // Overall = média ponderada dos pilares disponíveis (redistribuição de peso)
  let overall: number | null = null;
  if (available.length > 0) {
    const sum = available.reduce((acc, p) => acc + (p.value ?? 0) * p.weight, 0);
    overall = Math.round(sum / coveredWeight);
  }

  const factors: ScoreFactors = {
    positive: [],
    attention: [],
    unavailable: [],
  };

  for (const p of pillars) {
    if (!p.available) {
      factors.unavailable.push(
        p.key === "growth"
          ? "Crescimento: dados insuficientes para calcular"
          : p.key === "engagement"
            ? "Engajamento: sem dados de engajamento"
            : p.key === "reach"
              ? "Alcance: sem dados de alcance"
              : p.key === "consistency"
                ? "Consistência: precisa de mais sincronizações"
                : p.key === "frequency"
                  ? "Frequência: sem dados de publicações"
                  : "Desempenho: precisa de histórico"
      );
      continue;
    }
    const v = p.value ?? 0;
    if (v >= 70) factors.positive.push(`${p.label} (${v})`);
    else if (v <= 35) factors.attention.push(`${p.label} (${v})`);
  }

  return {
    platform,
    overall,
    pillars,
    factors,
    version: W.version,
    source: `${platform}-snapshots`,
    coverage,
    weighting: {
      engagement: W.engagement,
      growth: W.growth,
      reach: W.reach,
      consistency: W.consistency,
    },
  };
}

// ------------------------------------------------------------
// Persistência (ProfileScore + Snapshot)
// ------------------------------------------------------------

export async function persistScore(userId: string, result: ScoreResult) {
  if (result.overall == null) return null;

  const score = await ai.score.create({
    data: {
      userId,
      platform: result.platform,
      overall: result.overall,
      growth: result.pillars.find((p) => p.key === "growth")?.value ?? null,
      engagement: result.pillars.find((p) => p.key === "engagement")?.value ?? null,
      reach: result.pillars.find((p) => p.key === "reach")?.value ?? null,
      consistency: result.pillars.find((p) => p.key === "consistency")?.value ?? null,
      frequency: result.pillars.find((p) => p.key === "frequency")?.value ?? null,
      content: result.pillars.find((p) => p.key === "content")?.value ?? null,
      factors: JSON.parse(JSON.stringify(result.factors)),
      version: result.version,
      coverage: result.coverage,
      weighting: JSON.parse(JSON.stringify(result.weighting)),
    },
  });

  const scoreRow = score as unknown as { id: string; overall: number };
  await ai.scoreSnapshot.create({
    data: {
      userId,
      platform: result.platform,
      scoreId: scoreRow.id,
      overall: scoreRow.overall,
    },
  });

  return score;
}

export async function getScoreHistory(userId: string, platform: Platform) {
  const rows = await ai.score.findMany({
    where: { userId, platform },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows as {
    id: string;
    platform: string;
    overall: number;
    growth?: number | null;
    engagement?: number | null;
    reach?: number | null;
    consistency?: number | null;
    frequency?: number | null;
    content?: number | null;
    factors?: unknown;
    version: string;
    coverage?: number | null;
    weighting?: unknown;
    createdAt: Date;
  }[];
}

export async function getLatestScore(userId: string, platform: Platform) {
  const row = await ai.score.findFirst({
    where: { userId, platform },
    orderBy: { createdAt: "desc" },
  });
  return row as {
    id: string;
    overall: number;
    growth?: number | null;
    engagement?: number | null;
    reach?: number | null;
    consistency?: number | null;
    frequency?: number | null;
    content?: number | null;
    factors?: unknown;
    version: string;
    coverage?: number | null;
    weighting?: unknown;
    createdAt: Date;
  } | null;
}
