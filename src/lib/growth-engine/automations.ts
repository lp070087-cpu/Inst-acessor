import type { GrowthSignal, GrowthRecommendation, GrowthActionView } from "./types";

/**
 * AUTOMAÇÕES INTERNAS — Fase 8 (Parte 21)
 * =======================================
 * Regras de automação DENTRO do Inst Acessor. Transformam sinais em
 * recomendações/ações automaticamente — SEM ação externa real:
 *
 *   - GOAL_AT_RISK         → alerta (ver /api/growth/alertas)
 *   - HIGH_PERFORMING_CONTENT → recomendação de reproduzir conteúdo
 *   - INCONSISTENT_POSTING  → ação de planejamento (calendário)
 *
 * NUNCA envia DM real, NUNCA publica automaticamente, NUNCA responde
 * comentários automaticamente (ESCOPO-OFICIAL).
 *
 * Este módulo expõe as automações internas ATIVAS derivadas dos sinais
 * atuais, para a UI mostrar o que o motor fez com os dados.
 */

export interface InternalAutomation {
  id: string;
  rule: "GOAL_AT_RISK_ALERTA" | "HIGH_PERFORMING_REPLICAR" | "INCONSISTENT_PLANEJAR";
  sourceSignal: GrowthSignal["type"];
  title: string;
  description: string;
  platform: GrowthSignal["platform"];
  severity: GrowthSignal["severity"];
  /** o que a automação produz (alerta, recomendação ou ação) */
  output: "alerta" | "recomendacao" | "acao";
  /** referência à recomendação/ação gerada, quando houver */
  linkedRecommendationSlug: string | null;
}

function base(
  signal: GrowthSignal,
  output: InternalAutomation["output"],
  title: string,
  description: string,
  linkedRecommendationSlug: string | null
): InternalAutomation {
  return {
    id: `${signal.type}::${signal.platform ?? "ambas"}`,
    rule:
      signal.type === "GOAL_AT_RISK"
        ? "GOAL_AT_RISK_ALERTA"
        : signal.type === "HIGH_PERFORMING_CONTENT"
          ? "HIGH_PERFORMING_REPLICAR"
          : "INCONSISTENT_PLANEJAR",
    sourceSignal: signal.type,
    title,
    description,
    platform: signal.platform,
    severity: signal.severity,
    output,
    linkedRecommendationSlug,
  };
}

/**
 * Deriva as automações internas ativas a partir dos sinais atuais.
 * Reutiliza os sinais já calculados (não roda o motor de novo).
 */
export function buildInternalAutomations(
  signals: GrowthSignal[],
  recommendations: GrowthRecommendation[]
): InternalAutomation[] {
  const out: InternalAutomation[] = [];

  const recBySignal = new Map<string, GrowthRecommendation>();
  for (const rec of recommendations) recBySignal.set(rec.signalType, rec);

  for (const signal of signals) {
    if (signal.type === "GOAL_AT_RISK") {
      const rec = recBySignal.get("GOAL_AT_RISK");
      out.push(
        base(
          signal,
          "alerta",
          "Meta em risco",
          signal.evidence[0]?.detail ?? "Uma meta ativa está perto do prazo sem progresso suficiente.",
          rec?.slug ?? null
        )
      );
    } else if (signal.type === "HIGH_PERFORMING_CONTENT") {
      const rec = recBySignal.get("HIGH_PERFORMING_CONTENT");
      out.push(
        base(
          signal,
          "recomendacao",
          "Conteúdo de alto desempenho",
          signal.evidence[0]?.detail ?? "Conteúdo com bom resultado detectado — replique.",
          rec?.slug ?? null
        )
      );
    } else if (signal.type === "INCONSISTENT_POSTING") {
      const rec = recBySignal.get("INCONSISTENT_POSTING");
      out.push(
        base(
          signal,
          "acao",
          "Rotina de postagem irregular",
          signal.evidence[0]?.detail ?? "Postagens irregulares — planeje o calendário.",
          rec?.slug ?? null
        )
      );
    }
  }

  return out;
}

/** Confirma que as ações geradas estão ligadas à automação interna, sem ação externa real. */
export function automationSafetyNotes(): string[] {
  return [
    "Nenhuma DM real é enviada automaticamente.",
    "Nenhum conteúdo é publicado automaticamente.",
    "Nenhum comentário é respondido automaticamente.",
    "Todas as automações são internas (alertas, recomendações e ações no app).",
  ];
}
