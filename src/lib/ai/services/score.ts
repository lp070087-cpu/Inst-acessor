import { ai } from "@/lib/ai/db";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { getMediaProductionData } from "@/lib/dashboard/media-production";
import { GROWTH_SCORE_V1 } from "@/lib/knowledge";

/**
 * Score Inteligente (0–100) — FÓRMULA OFICIAL growth-score-v1.
 *
 * Pesos oficiais (docs/KNOWLEDGE-ENGINE.md, Módulo 19):
 *   30% Engajamento · 25% Crescimento · 25% Alcance · 20% Consistência.
 *
 * O QUE MUDOU (e por quê)
 * -----------------------
 * O Score reportava ~60/100 com 20% de cobertura. A causa não era o cálculo da
 * média: era (a) o pilar "Consistência" ter uma fórmula que devolvia uma nota
 * ALTA pelo simples fato de existir um segundo registro, e (b) a cobertura ser
 * medida em PESO, de modo que um único pilar pequeno já a fazia parecer cheia.
 *
 * Agora:
 *   - o Score Geral só é publicado quando há EVIDÊNCIA MÍNIMA (ver abaixo);
 *   - a cobertura mede QUANTOS dos pilares têm evidência, não quanto peso eles
 *     somam;
 *   - nenhum pilar recebe nota por ausência — ausência vira "sem dados".
 *
 * REGRA DE OURO: ausência de dado NÃO é desempenho positivo e NÃO é nota zero.
 * Ausência é NÃO AVALIADO.
 *
 * Versionamento: os PESOS continuam sendo `growth-score-v1`. As funções de
 * normalização abaixo são heurísticas determinísticas e explicáveis (escalas
 * lineares com teto documentado) — não são estatística inferencial.
 */

// ------------------------------------------------------------
// Critério mínimo de evidência
// ------------------------------------------------------------

/**
 * Quantos dos 4 pilares oficiais precisam ter dado real para publicar o Score.
 *
 * 3 de 4. Com 3 pilares o número já é sustentado por evidência majoritária; com
 * 2 ou menos, o resultado seria dominado por um único fator e viraria uma nota
 * com aparência de avaliação completa. Este limiar junto com a cobertura mínima
 * (abaixo) elimina exatamente o caso que gerava o "60 com 20%".
 */
export const MIN_PILLARS_MEASURED = 3;

/** Cobertura mínima (%) dos pilares para publicar o Score Geral. */
export const MIN_MEASURABILITY = 60;

/**
 * Sem pelo menos 2 sincronizações não existe NENHUMA dimensão temporal, e dois
 * dos quatro pilares (Crescimento e Consistência) são temporais por definição.
 * Por isso o Score Geral não é publicado com um único snapshot.
 */
export const MIN_SNAPSHOTS_FOR_OVERALL = 2;

// ------------------------------------------------------------
// Tetos das escalas (explícitos, determinísticos)
// ------------------------------------------------------------

/** Interações (curtidas + comentários) por publicação consideradas nota 100. */
const ENGAGEMENT_TARGET = 500;
/** Variação percentual de seguidores considerada nota 100. */
const GROWTH_TARGET_PCT = 50;
/** Alcance (soma de 7 dias) considerado nota 100. */
const REACH_TARGET = 100_000;
/** Sincronizações necessárias para a Consistência chegar a 100. */
const CONSISTENCY_FULL_SNAPSHOTS = 12;

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
  /** null = Score Geral NÃO publicado por falta de evidência mínima. */
  overall: number | null;
  pillars: ScorePillar[];
  factors: ScoreFactors;
  /** Identificador da fórmula (versionável). */
  version: string;
  source: string;
  /** % dos pilares oficiais COM evidência (0–100). Não é peso: é contagem. */
  coverage: number | null;
  /** Quantos dos 4 pilares oficiais têm dado real. */
  measuredPillars: number;
  /** Total de pilares oficiais considerados. */
  totalPillars: number;
  /** O Score Geral está publicado? Quando false, `reason` explica. */
  scoreAvailable: boolean;
  /** Motivo legível quando o Score Geral não é publicado. */
  reason: string | null;
  /** Pesos aplicados (growth-score-v1). */
  weighting: { engagement: number; growth: number; reach: number; consistency: number };
}

export type Platform = "instagram" | "tiktok";

interface SignalSource {
  followers: number | null;
  /** Média REAL de curtidas + comentários por publicação coletada. */
  engagement: number | null;
  reach: number | null;
  media: number | null;
  snapshotCount: number;
  hasTwoPoints: boolean;
  /** Variação % de seguidores em relação à sincronização anterior. */
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
    // Mesma camada de dados usada pelo Dashboard — as duas telas NÃO podem
    // discordar sobre a mesma métrica.
    const [d, media] = await Promise.all([
      getDashboardInstagramData(userId),
      getMediaProductionData(userId),
    ]);
    return {
      followers: d.followersCount ?? null,
      engagement: d.cards.engagement.value ?? null,
      reach: d.cards.reach7d.value ?? d.cards.reach.value ?? null,
      media: d.mediaCount ?? null,
      snapshotCount: d.snapshotCount,
      hasTwoPoints: d.snapshotCount >= 2,
      // Variação desde a sincronização anterior (o Dashboard usa a mesma).
      periodGrowthPct: d.cards.followers.changePercent ?? null,
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
    periodGrowthPct: d.cards.followers.changePercent ?? null,
  };
}

// ------------------------------------------------------------
// Heurísticas determinísticas (explicáveis, sem inventar dados)
// ------------------------------------------------------------

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Crescimento: variação % de seguidores desde a sincronização anterior.
 *
 * `null` sem duas medições — um único registro NÃO é crescimento estável nem
 * 0%. Também respeita o caso de base zero (que não tem variação relativa).
 */
function growthScore(pct: number | null): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return Math.round(clamp01(pct / GROWTH_TARGET_PCT) * 100);
}

/**
 * Engajamento: média REAL de interações por publicação.
 *
 * Exige a média medida — não presume curtidas nem comentários ausentes como 0.
 */
function engagementScore(engagement: number | null): number | null {
  if (engagement == null || !Number.isFinite(engagement)) return null;
  return Math.round(clamp01(engagement / ENGAGEMENT_TARGET) * 100);
}

/**
 * Alcance: valor absoluto medido, na MESMA escala do card do Dashboard.
 * NÃO é inferido a partir dos seguidores.
 */
function reachScore(reach: number | null): number | null {
  if (reach == null || !Number.isFinite(reach)) return null;
  return Math.round(clamp01(reach / REACH_TARGET) * 100);
}

/**
 * Consistência: profundidade REAL do histórico de sincronizações.
 *
 * A fórmula é uma rampa baixa e longa (piso 20, satura em 12 sincronizações).
 * Uma conta recém-sincronizada com 2 registros tira 25 — não uma nota alta
 * pelo simples fato de o segundo registro existir.
 */
function consistencyScore(signal: SignalSource): number | null {
  if (signal.snapshotCount < 2) return null;
  const ramp = Math.min(signal.snapshotCount, CONSISTENCY_FULL_SNAPSHOTS) - 2;
  const span = CONSISTENCY_FULL_SNAPSHOTS - 2;
  return Math.round(20 + (ramp / span) * 80);
}

/**
 * Frequência: publicações já coletadas da conta (complementar, não pesa).
 * Usa o `mediaCount` real — não uma janela temporal que não temos.
 */
function frequencyScore(signal: SignalSource): number | null {
  if (signal.media == null || signal.media <= 0) return null;
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
      value: engagementScore(signal.engagement),
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
      value: reachScore(signal.reach),
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

  const official = pillars.filter((p) => !p.complementary);
  // "Medido" exige valor E disponibilidade: um pilar disponível sem valor não
  // pode contar como evidência.
  const measured = official.filter((p) => p.available && p.value != null);

  // Cobertura = QUANTOS pilares oficiais têm evidência, não quanto peso somam.
  // É isso que impede um único pilar pequeno de "encher" a cobertura.
  const coverage =
    official.length > 0 ? Math.round((measured.length / official.length) * 100) : null;

  // ---- Critério mínimo de evidência ----
  let reason: string | null = null;
  if (signal.snapshotCount < MIN_SNAPSHOTS_FOR_OVERALL) {
    reason =
      "Sincronize mais dados para gerar uma avaliação confiável. Com um único registro não existe dimensão temporal.";
  } else if (measured.length < MIN_PILLARS_MEASURED) {
    reason = `Score ainda não disponível: apenas ${measured.length} de ${official.length} pilares têm dados. São necessários ao menos ${MIN_PILLARS_MEASURED}.`;
  } else if (coverage != null && coverage < MIN_MEASURABILITY) {
    reason = `Score ainda não disponível: cobertura de ${coverage}%. São necessários ao menos ${MIN_MEASURABILITY}%.`;
  }

  const scoreAvailable = reason == null;

  // Overall = média ponderada dos pilares MEDIDOS, com peso redistribuído.
  // Só é calculado quando há evidência suficiente; caso contrário permanece
  // null (a UI mostra "Score ainda não disponível" — nunca um número enganoso).
  let overall: number | null = null;
  if (scoreAvailable) {
    const coveredWeight = measured.reduce((acc, p) => acc + p.weight, 0);
    if (coveredWeight > 0) {
      const sum = measured.reduce((acc, p) => acc + (p.value ?? 0) * p.weight, 0);
      overall = Math.round(sum / coveredWeight);
    }
  }

  const factors: ScoreFactors = {
    positive: [],
    attention: [],
    unavailable: [],
  };

  const UNAVAILABLE_TEXT: Record<string, string> = {
    growth: "Crescimento: dados insuficientes para calcular",
    engagement: "Engajamento: sem dados de engajamento",
    reach: "Alcance: sem dados de alcance",
    consistency: "Consistência: precisa de mais sincronizações",
    frequency: "Frequência: sem dados de publicações",
    content: "Desempenho: precisa de histórico",
  };

  for (const p of pillars) {
    if (!p.available || p.value == null) {
      factors.unavailable.push(UNAVAILABLE_TEXT[p.key] ?? `${p.label}: sem dados`);
      continue;
    }
    const v = p.value;
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
    measuredPillars: measured.length,
    totalPillars: official.length,
    scoreAvailable,
    reason,
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
  // Nunca registra um Score Geral inválido no histórico: sem evidência mínima
  // não existe número para gravar, e um histórico falso não pode ser criado.
  if (result.overall == null || !result.scoreAvailable) return null;

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
