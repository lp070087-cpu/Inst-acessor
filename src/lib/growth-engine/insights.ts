import type { GrowthContext, GrowthSignal } from "./types";

/**
 * INSIGHTS PROATIVOS AUTOMÁTICOS — Fase 8 (Parte 11)
 * ====================================================
 * Deriva insights proativos (dados reais) que a UI pode exibir sem
 * ação do usuário. Preparado para integração futura com jobs/sync
 * (a detecção é pura e determinística — chamada sob demanda).
 *
 * Cada insight declara sua origem: DADO REAL, INFERÊNCIA ou RECOMENDAÇÃO.
 * NUNCA inventa métricas.
 */

export type ProactiveInsightKind =
  | "DADO_REAL"
  | "INFERENCIA"
  | "RECOMENDACAO"
  | "DADO_INSUFICIENTE";

export interface ProactiveInsight {
  id: string; // estável: signalType + plataforma
  kind: ProactiveInsightKind;
  title: string;
  detail: string;
  signalType: GrowthSignal["type"];
  platform: GrowthSignal["platform"];
  severity: GrowthSignal["severity"];
  confidence: number;
  detectedAt: string;
}

function idFor(signal: GrowthSignal): string {
  return `${signal.type}::${signal.platform ?? "ambas"}`;
}

function toInsight(signal: GrowthSignal): ProactiveInsight {
  const evidence = signal.evidence[0]?.detail ?? "";
  return {
    id: idFor(signal),
    kind: signal.confidence >= 0.9 ? "DADO_REAL" : signal.confidence >= 0.6 ? "INFERENCIA" : "DADO_INSUFICIENTE",
    title: signal.type.replace(/_/g, " ").toLowerCase(),
    detail: evidence,
    signalType: signal.type,
    platform: signal.platform,
    severity: signal.severity,
    confidence: signal.confidence,
    detectedAt: signal.detectedAt,
  };
}

/**
 * Converte sinais em insights proativos. Ordena por severidade.
 * Sem sinais → vazio (nenhum insight inventado).
 */
export function buildProactiveInsights(signals: GrowthSignal[]): ProactiveInsight[] {
  const order: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  return signals
    .map(toInsight)
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Resumo em texto curto do que mudou (para notificação futura). */
export function summarizeChanges(ctx: GrowthContext, signals: GrowthSignal[]): string[] {
  const out: string[] = [];
  for (const signal of signals) {
    if (signal.severity === "INFO" || signal.severity === "LOW") continue;
    const platform = signal.platform === "tiktok" ? "TikTok" : signal.platform === "instagram" ? "Instagram" : "perfil";
    out.push(`[${platform}] ${signal.evidence[0]?.detail ?? signal.type}`);
  }
  return out.slice(0, 5);
}
