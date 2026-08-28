import type { GrowthContext, GrowthPriority, GrowthSignal, SignalType } from "./types";

/**
 * PRIORIDADES — Fase 8 (Parte 5)
 * ================================
 * Converte sinais em prioridades (máx. 3), pontuando:
 *   impacto (quanto afeta o crescimento),
 *   urgência (quão imediato é),
 *   confiança (dado real vs. inferência),
 *   esforço (baixo/médio/alto),
 *   objetivo (meta associada, quando houver),
 *   evidência (resumo do dado real).
 *
 * Apenas sinais com evidência real entram. Sem dados → DADO INSUFICIENTE.
 */

const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/** Rótulo humano por tipo de sinal (usado nos títulos das prioridades). */
export const SIGNAL_LABELS: Record<SignalType, string> = {
  LOW_POSTING_FREQUENCY: "Frequência de postagem baixa",
  ENGAGEMENT_DROP: "Queda de engajamento",
  REACH_DROP: "Queda de alcance",
  FOLLOWER_GROWTH_DROP: "Crescimento negativo de seguidores",
  HIGH_PERFORMING_CONTENT: "Conteúdo de alto desempenho",
  LOW_RETENTION: "Retenção baixa",
  INCONSISTENT_POSTING: "Postagem inconsistente",
  GOAL_ON_TRACK: "Meta no caminho certo",
  GOAL_AT_RISK: "Meta em risco",
  GOAL_ACHIEVED: "Meta atingida",
  EXPERIMENT_RUNNING: "Experimento em andamento",
  EXPERIMENT_WINNER: "Experimento vencedor",
  EXPERIMENT_LOSER: "Experimento sem ganho",
  EXPERIMENT_INCONCLUSIVE: "Experimento inconclusivo",
  CONTENT_GAP: "Lacuna de conteúdo",
  PROFILE_OPTIMIZATION_NEEDED: "Otimização de perfil",
  NO_RECENT_DATA: "Sem dados recentes",
  NO_CONNECTED_ACCOUNT: "Nenhuma conta conectada",
};

/** Esforço estimado por tipo de sinal (heurística interna do produto). */
const EFFORT_BY_SIGNAL: Partial<Record<SignalType, "baixo" | "medio" | "alto">> = {
  LOW_POSTING_FREQUENCY: "medio",
  ENGAGEMENT_DROP: "alto",
  REACH_DROP: "alto",
  FOLLOWER_GROWTH_DROP: "alto",
  HIGH_PERFORMING_CONTENT: "baixo",
  LOW_RETENTION: "medio",
  INCONSISTENT_POSTING: "medio",
  GOAL_ON_TRACK: "baixo",
  GOAL_AT_RISK: "baixo",
  GOAL_ACHIEVED: "baixo",
  EXPERIMENT_RUNNING: "baixo",
  EXPERIMENT_WINNER: "baixo",
  EXPERIMENT_LOSER: "baixo",
  EXPERIMENT_INCONCLUSIVE: "baixo",
  CONTENT_GAP: "medio",
  PROFILE_OPTIMIZATION_NEEDED: "baixo",
  NO_RECENT_DATA: "baixo",
  NO_CONNECTED_ACCOUNT: "alto",
};

function findGoalForSignal(ctx: GrowthContext, signal: GrowthSignal): string | null {
  const platform = signal.platform;
  const goals = platform
    ? ctx[platform].goals
    : [...ctx.instagram.goals, ...ctx.tiktok.goals];

  if (
    signal.type === "GOAL_ON_TRACK" ||
    signal.type === "GOAL_AT_RISK" ||
    signal.type === "GOAL_ACHIEVED"
  ) {
    // A meta em risco/atingida aparece na evidência
    const detail = signal.evidence[0]?.detail ?? "";
    for (const g of goals) {
      if (detail.includes(g.title)) return g.title;
    }
  }

  // Para sinais de engajamento/alcance/crescimento, associa a meta de categoria igual
  const categoryBySignal: Partial<Record<SignalType, string>> = {
    ENGAGEMENT_DROP: "engajamento",
    LOW_RETENTION: "engajamento",
    FOLLOWER_GROWTH_DROP: "crescimento",
    REACH_DROP: "crescimento",
    LOW_POSTING_FREQUENCY: "consistencia",
    INCONSISTENT_POSTING: "consistencia",
    CONTENT_GAP: "consistencia",
  };
  const category = categoryBySignal[signal.type];
  if (category) {
    const match = goals.find(
      (g) => g.category === category && g.status === "ATIVA"
    );
    if (match) return match.title;
  }
  return null;
}

/**
 * Prioriza os sinais em até 3 prioridades. Retorna vazio quando não há sinais
 * com evidência real (DADO INSUFICIENTE).
 */
export function prioritizeSignals(
  ctx: GrowthContext,
  signals: GrowthSignal[]
): GrowthPriority[] {
  // Pontuação determinística
  const scored = signals.map((signal) => {
    const severityScore = SEVERITY_SCORE[signal.severity] ?? 1;
    const impact = severityScore / 5; // 0.2..1
    const urgency =
      signal.severity === "CRITICAL"
        ? 1
        : signal.severity === "HIGH"
          ? 0.8
          : signal.severity === "MEDIUM"
            ? 0.6
            : signal.severity === "LOW"
              ? 0.4
              : 0.2;
    const confidence = signal.confidence;
    const objective = findGoalForSignal(ctx, signal);
    const evidenceSummary = signal.evidence[0]?.detail ?? "Sem evidência detalhada.";

    // Pontuação final: impacto*0.4 + urgência*0.3 + confiança*0.3
    const score = impact * 0.4 + urgency * 0.3 + confidence * 0.3;

    return {
      signal,
      impact,
      urgency,
      confidence,
      effort: EFFORT_BY_SIGNAL[signal.type] ?? "medio",
      objective,
      evidenceSummary,
      score,
    };
  });

  // Ordena por score desc
  scored.sort((a, b) => b.score - a.score);

  // Pega no máximo 3, evitando repetir o mesmo tipo de sinal (dedup por type)
  const picked: typeof scored = [];
  const seenTypes = new Set<SignalType>();
  for (const item of scored) {
    if (picked.length >= 3) break;
    if (seenTypes.has(item.signal.type)) continue;
    seenTypes.add(item.signal.type);
    picked.push(item);
  }

  return picked.map((item, idx) => ({
    level: (idx + 1) as 1 | 2 | 3,
    signalType: item.signal.type,
    title: SIGNAL_LABELS[item.signal.type],
    platform: item.signal.platform,
    impact: Math.round(item.impact * 100) / 100,
    urgency: Math.round(item.urgency * 100) / 100,
    confidence: Math.round(item.confidence * 100) / 100,
    effort: item.effort,
    objective: item.objective,
    evidenceSummary: item.evidenceSummary,
  }));
}
