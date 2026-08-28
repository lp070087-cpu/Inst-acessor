/**
 * TIPOS CENTRAIS DO GROWTH ENGINE — Fase 8
 * =========================================
 * Motor Operacional de Crescimento. Interpreta dados REAIS já persistidos
 * (dashboard, baseline, score, metas, experimentos, conteúdo) e produz:
 *   sinais → prioridades → recomendações → ações → acompanhamento.
 *
 * REGRA ABSOLUTA (ESCOPO-OFICIAL): nunca inventar dados. Quando um dado não
 * existe ou está desatualizado, o sinal/prioridade/recomendação declara
 * `DADO INSUFICIENTE` e a confiança reduz — jamais preenche com estimativa.
 */

import type { Platform } from "@/lib/ai/services";
import type { AlertSeverity } from "@/lib/knowledge/types";

// ------------------------------------------------------------
// ESTADOS DE DADOS (Parte 23)
// ------------------------------------------------------------
export type DataStatus =
  | "SEM_REDE" // nenhuma conta conectada
  | "SEM_SYNC" // conectada mas nunca sincronizou (sem snapshots)
  | "POUCOS_DADOS" // poucos snapshots (insuficiente para tendências)
  | "DADOS_SUFICIENTES"; // dados reais suficientes

export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  SEM_REDE: "Nenhuma rede conectada",
  SEM_SYNC: "Conectada, aguardando primeira sincronização",
  POUCOS_DADOS: "Poucos dados ainda",
  DADOS_SUFICIENTES: "Dados suficientes",
};

// ------------------------------------------------------------
// SINAIS DETERMINÍSTICOS (Parte 4)
// ------------------------------------------------------------
export type SignalType =
  | "LOW_POSTING_FREQUENCY"
  | "ENGAGEMENT_DROP"
  | "REACH_DROP"
  | "FOLLOWER_GROWTH_DROP"
  | "HIGH_PERFORMING_CONTENT"
  | "LOW_RETENTION"
  | "INCONSISTENT_POSTING"
  | "GOAL_ON_TRACK"
  | "GOAL_AT_RISK"
  | "GOAL_ACHIEVED"
  | "EXPERIMENT_RUNNING"
  | "EXPERIMENT_WINNER"
  | "EXPERIMENT_LOSER"
  | "EXPERIMENT_INCONCLUSIVE"
  | "CONTENT_GAP"
  | "PROFILE_OPTIMIZATION_NEEDED"
  | "NO_RECENT_DATA"
  | "NO_CONNECTED_ACCOUNT";

export type SignalSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const SIGNAL_SEVERITY_ORDER: SignalSeverity[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export interface SignalEvidence {
  /** descrição curta do dado real que originou o sinal */
  detail: string;
  /** valor real observado (quando existir) */
  value?: number | null;
  /** valor de referência (baseline/período anterior) */
  reference?: number | null;
  /** plataforma associada */
  platform?: Platform | null;
}

export interface GrowthSignal {
  type: SignalType;
  severity: SignalSeverity;
  confidence: number; // 0..1 — reduz quando faltam dados
  evidence: SignalEvidence[];
  platform: Platform | null;
  detectedAt: string; // ISO
}

// ------------------------------------------------------------
// PRIORIDADES (Parte 5) — máx. 3
// ------------------------------------------------------------
export type PriorityLevel = 1 | 2 | 3;

export interface GrowthPriority {
  level: PriorityLevel;
  signalType: SignalType;
  title: string;
  platform: Platform | null;
  impact: number; // 0..1
  urgency: number; // 0..1
  confidence: number; // 0..1
  effort: "baixo" | "medio" | "alto";
  objective: string | null; // meta associada (title) quando houver
  evidenceSummary: string;
}

// ------------------------------------------------------------
// RECOMENDAÇÕES (Parte 6)
// ------------------------------------------------------------
export interface GrowthRecommendation {
  slug: string; // ex.: "low-posting-frequency-1"
  signalType: SignalType;
  platform: Platform | null;
  oQue: string; // o que fazer
  porQue: string; // por que
  evidencia: string; // dado real
  como: string; // como fazer (passo a passo)
  quando: string; // quando fazer
  resultadoEsperado: string; // resultado esperado
  metrica: string; // métrica a observar
  confianca: number; // 0..1
  priorityLevel: PriorityLevel;
}

// ------------------------------------------------------------
// AÇÕES (Parte 7) — persistidas em GrowthAction
// ------------------------------------------------------------
export const GROWTH_ACTION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DISMISSED",
  "EXPIRED",
] as const;
export type GrowthActionStatus = (typeof GROWTH_ACTION_STATUSES)[number];

export interface GrowthActionView {
  id: string;
  platform: Platform;
  title: string;
  description: string | null;
  reason: string | null;
  priority: PriorityLevel;
  status: GrowthActionStatus;
  dueAt: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  sourceSignal: SignalType | null;
  sourceRecommendation: string | null;
  metricToWatch: string | null;
  baselineValue: number | null;
  resultValue: number | null;
  resultNote: string | null;
  xpGranted: boolean;
  createdAt: string;
}

export interface CreateGrowthActionInput {
  platform: Platform;
  title: string;
  description?: string | null;
  reason?: string | null;
  priority: PriorityLevel;
  dueAt?: string | null;
  sourceSignal?: SignalType | null;
  sourceRecommendation?: string | null;
  metricToWatch?: string | null;
  baselineValue?: number | null;
}

// ------------------------------------------------------------
// CONTEXTO AGREGADO (Parte 3)
// ------------------------------------------------------------
export interface PlatformContext {
  platform: Platform;
  connected: boolean;
  status: DataStatus;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  /** variação % vs período anterior (real, quando disponível) */
  cardsEngagementChange: number | null;
  cardsReachChange: number | null;
  growth: number | null; // crescimento mensal (%)
  mediaCount: number | null;
  snapshotCount: number;
  lastSyncAt: string | null;
  posts: number | null; // publicações no período (30d)
  frequency: number | null; // posts/semana (quando calculável)
  bestContent: { label: string; date: string; value: number }[];
  worstContent: { label: string; date: string; value: number }[];
  score: number | null;
  scoreCoverage: number | null;
  goals: { id: string; title: string; category: string; progressPercent: number; status: string; deadline: string | null; targetValue: number | null; currentValue: number | null; platform: string | null }[];
  experiments: { id: string; hypothesis: string; status: string; platform: string | null }[];
  alerts: { code: string; severity: AlertSeverity; title: string }[];
  plannedContent: { id: string; title: string; status: string; scheduledAt: string | null }[];
  publishedCount: number;
}

export interface GrowthContext {
  userId: string;
  userProfile: {
    objective: string | null;
    niche: string | null;
    displayName: string | null;
  };
  stage: string | null; // estágio (ex.: "inicio", "crescimento") — de AIProfile/onboarding
  instagram: PlatformContext;
  tiktok: PlatformContext;
  insights: { id: string; type: string; summary: string; platform: string | null }[];
  intelligenceProfile: {
    summary: string | null;
    preferredFormats: string | null;
    postingFrequency: string | null;
    observedPatterns: string | null;
  };
  confidence: number; // 0..1 — reduz conforme dados ausentes
  generatedAt: string;
}

// ------------------------------------------------------------
// MISSÃO DO DIA (Parte 8)
// ------------------------------------------------------------
export interface DailyMission {
  action: GrowthActionView | null;
  rationale: string;
  sourceSignal: SignalType | null;
  platform: Platform | null;
  date: string;
}

// ------------------------------------------------------------
// PLANOS (Partes 9-10)
// ------------------------------------------------------------
export interface DayPlan {
  day: number; // 1..7
  date: string; // ISO
  focus: string; // ex.: "conteúdo"
  items: {
    type: "conteudo" | "otimizacao" | "comunidade" | "analise" | "experimento" | "meta";
    action: string;
    recommendationSlug: string | null;
    platform: Platform | null;
  }[];
}

export interface GrowthPlan7Days {
  days: DayPlan[];
  generatedAt: string;
  note: string;
}

export interface GrowthPlan30Days {
  weeks: {
    week: 1 | 2 | 3 | 4;
    theme: string;
    focus: string;
    items: string[];
  }[];
  generatedAt: string;
  note: string;
}

// ------------------------------------------------------------
// ERROS
// ------------------------------------------------------------
export class GrowthEngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
