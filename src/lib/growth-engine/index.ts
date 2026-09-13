/**
 * BARREL — MOTOR OPERACIONAL DE CRESCIMENTO (Fase 8)
 * ====================================================
 * Camada `src/lib/growth-engine`:
 *   engine.ts        — orquestração do pipeline completo
 *   context.ts       — GrowthContext agregado (dados reais)
 *   signals.ts       — sinais determinísticos
 *   priorities.ts    — prioridades (máx. 3)
 *   recommendations.ts — recomendações acionáveis
 *   actions.ts       — GrowthAction (plano de ação) + XP
 *   progress.ts      — missão do dia + planos 7/30 dias
 *   insights.ts      — insights proativos automáticos
 *   db.ts            — delegate Prisma (GrowthAction)
 *   errors.ts        — erros controlados
 */

// Orquestração
export { runGrowthEngine, type EngineOutput } from "./engine";
export { runGrowthPipeline, type GrowthPipelineOutput } from "./pipeline";
export { buildGrowthContext } from "./context";
export { detectSignals } from "./signals";
export { prioritizeSignals, SIGNAL_LABELS } from "./priorities";
export { buildRecommendations } from "./recommendations";

// Ações (GrowthAction + XP)
export {
  listActions,
  getAction,
  createAction,
  updateActionStatus,
  deleteAction,
  completeActionWithXp,
  expireOverdueActions,
  syncRecommendationsToActions,
} from "./actions";

// Progresso (Missão do Dia + Planos 7/30 dias)
export {
  pickDailyMission,
  buildPlan7Days,
  buildPlan30Days,
} from "./progress";

// Insights proativos
export {
  buildProactiveInsights,
  summarizeChanges,
  type ProactiveInsight,
  type ProactiveInsightKind,
} from "./insights";

// Prompt/contexto para IA (Parte 14)
export { growthContextToPrompt } from "./prompt";

// Automações internas (Parte 21)
export {
  buildInternalAutomations,
  automationSafetyNotes,
  type InternalAutomation,
} from "./automations";

// Acesso a dados
export { ge } from "./db";

// Tipos
export {
  DATA_STATUS_LABELS,
  SIGNAL_SEVERITY_ORDER,
  GROWTH_ACTION_STATUSES,
  GrowthEngineError,
  type DataStatus,
  type SignalType,
  type SignalSeverity,
  type SignalEvidence,
  type GrowthSignal,
  type GrowthPriority,
  type PriorityLevel,
  type GrowthRecommendation,
  type GrowthActionStatus,
  type GrowthActionView,
  type CreateGrowthActionInput,
  type PlatformContext,
  type GrowthContext,
  type DailyMission,
  type DayPlan,
  type GrowthPlan7Days,
  type GrowthPlan30Days,
} from "./types";

// Erros
export { toGrowthHttpError } from "./errors";
