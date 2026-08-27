/**
 * CÉREBRO ESTRATÉGICO — INST ACESSOR (FASE 4.5)
 * ===============================================
 * Tipos centrais do Knowledge Engine.
 *
 * A fonte oficial de conhecimento é a DONA do projeto (30 módulos registrados
 * em `src/lib/knowledge/rules/`). Nada de metodologia externa ou genérica.
 *
 * Categorias de confiabilidade (nunca misturar):
 *  - DADO REAL      → informação da API/snapshot/banco.
 *  - CONHECIMENTO   → regra/metodologia oficial fornecida pela DONA.
 *  - INFERÊNCIA     → interpretação derivada dos dados.
 *  - HIPÓTESE       → explicação possível que precisa de teste.
 *  - RECOMENDAÇÃO   → próxima ação sugerida.
 */

/** Tipos possíveis de um item de conhecimento. */
export type KnowledgeRuleType =
  | "PRINCIPLE" // princípio fundamental
  | "DIAGNOSTIC_RULE" // regra de diagnóstico
  | "STRATEGY_RULE" // regra de estratégia
  | "CONTENT_RULE" // regra de conteúdo
  | "METRIC_RULE" // regra sobre métricas
  | "EXPERIMENT_RULE" // regra de experimentação
  | "AI_GUARDRAIL"; // limite de comportamento da IA

export type KnowledgePriority = "ALTA" | "MEDIA" | "BAIXA";

/** Um item de conhecimento oficial. */
export interface KnowledgeRule {
  /** Identificador único legível (ex.: "ciclo-principal"). */
  slug: string;
  /** Módulo 01–30 a que pertence. */
  module: number;
  title: string;
  type: KnowledgeRuleType;
  /** Categoria temática (ex.: "conteudo", "retencao", "crescimento"). */
  category: string;
  /** Conteúdo oficial da regra — fiel ao fornecido pela DONA. */
  content: string;
  priority: KnowledgePriority;
  /** Tags para recuperação contextual (determinística). */
  tags: string[];
  version: number;
}

/** Um módulo de conhecimento (01–30). */
export interface KnowledgeModule {
  number: number;
  slug: string;
  title: string;
  description: string;
  rules: KnowledgeRule[];
}

/** Categorias de confiabilidade (regra fundamental). */
export type EvidenceKind =
  | "DADO_REAL"
  | "CONHECIMENTO"
  | "INFERENCIA"
  | "HIPOTESE"
  | "RECOMENDACAO";

export interface EvidenceAttribution {
  kind: EvidenceKind;
  label: string;
}

/** Status do experimento (oficial). */
export type ExperimentStatus =
  | "DRAFT"
  | "RUNNING"
  | "ENOUGH_DATA"
  | "CONFIRMED"
  | "REJECTED"
  | "INCONCLUSIVE"
  | "ARCHIVED";

export const EXPERIMENT_STATUSES: ExperimentStatus[] = [
  "DRAFT",
  "RUNNING",
  "ENOUGH_DATA",
  "CONFIRMED",
  "REJECTED",
  "INCONCLUSIVE",
  "ARCHIVED",
];

/** Tipos de aprendizado do perfil. */
export type InsightType =
  | "OBSERVED" // observado nos dados reais
  | "INFERRED" // inferência derivada (nunca promovida sozinha a confirmada)
  | "CONFIRMED_BY_EXPERIMENT"; // confirmado por experimento controlado

export const INSIGHT_TYPES: InsightType[] = [
  "OBSERVED",
  "INFERRED",
  "CONFIRMED_BY_EXPERIMENT",
];

/** Severidade de alertas. */
export type AlertSeverity = "ALTA" | "MEDIA" | "BAIXA";

export const ALERT_SEVERITIES: AlertSeverity[] = ["ALTA", "MEDIA", "BAIXA"];

/** Identificadores oficiais de alerta. */
export type AlertCode =
  | "ALCANCE_CAIU"
  | "ALCANCE_AUMENTOU"
  | "ENGAJAMENTO_CAIU"
  | "ENGAJAMENTO_AUMENTOU"
  | "CRESCIMENTO_DESACELERANDO"
  | "DIAS_SEM_POSTAR"
  | "REEL_FRACO"
  | "CONTEUDO_ACIMA_DA_MEDIA";

/** Um alerta determinístico gerado pelo motor. */
export interface GrowthAlert {
  code: AlertCode;
  platform: "instagram" | "tiktok";
  severity: AlertSeverity;
  title: string;
  detail: string;
  metric: string;
  /** Valor da métrica quando disponível. */
  value: number | null;
  /** Referência contextual (threshold aplicado). */
  reference: string;
  /** Regra oficial que sustenta o alerta (slug). */
  ruleSlug: string;
}

/** Score oficial — ponderação inicial versionável (growth-score-v1). */
export interface ScoreWeighting {
  version: string; // "growth-score-v1"
  engagement: number; // 30
  growth: number; // 25
  reach: number; // 25
  consistency: number; // 20
}

export const GROWTH_SCORE_V1: ScoreWeighting = {
  version: "growth-score-v1",
  engagement: 30,
  growth: 25,
  reach: 25,
  consistency: 20,
};

/** Baseline individual — comparar sempre com o próprio perfil. */
export interface IndividualBaseline {
  platform: "instagram" | "tiktok";
  followers: number | null;
  engagement: number | null;
  reach: number | null;
  mediaCount: number | null;
  snapshotCount: number;
  /** Mediana de desempenho por formato quando houver dados. */
  byFormat: { format: string; median: number | null; sample: number }[];
}
