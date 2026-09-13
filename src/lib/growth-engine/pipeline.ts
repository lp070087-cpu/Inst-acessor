import { runGrowthEngine } from "./engine";
import {
  listActions,
  expireOverdueActions,
  syncRecommendationsToActions,
} from "./actions";
import { pickDailyMission, buildPlan7Days, buildPlan30Days } from "./progress";
import {
  buildProactiveInsights,
  summarizeChanges,
  type ProactiveInsight,
} from "./insights";
import { buildInternalAutomations, type InternalAutomation } from "./automations";
import type {
  DailyMission,
  GrowthPlan7Days,
  GrowthPlan30Days,
  GrowthContext,
  GrowthSignal,
  GrowthPriority,
  GrowthRecommendation,
  GrowthActionView,
} from "./types";

/**
 * PIPELINE COMPLETO (Fase 8, Parte 2)
 * ===================================
 * Consolida o fluxo usado pela rota `/api/growth/engine` E pela página
 * server-side `/growth`: roda o motor, sincroniza recomendações → ações,
 * expira vencidas, monta missão do dia + planos 7/30 dias + insights.
 *
 * Reutiliza apenas módulos existentes — não duplica lógica.
 */
export interface GrowthPipelineOutput {
  context: GrowthContext;
  signals: GrowthSignal[];
  priorities: GrowthPriority[];
  recommendations: GrowthRecommendation[];
  actions: GrowthActionView[];
  createdActions: string[];
  mission: DailyMission | null;
  plan7: GrowthPlan7Days;
  plan30: GrowthPlan30Days;
  insights: ProactiveInsight[];
  automations: InternalAutomation[];
  changes: string[];
  confidence: number;
  insufficientData: boolean;
}

export async function runGrowthPipeline(userId: string): Promise<GrowthPipelineOutput> {
  // Expira ações vencidas antes de recomputar (Parte 7).
  await expireOverdueActions(userId);

  // Pipeline puro: dados reais → sinais → prioridades → recomendações.
  const engine = await runGrowthEngine(userId);

  // Sincroniza recomendações atuais como ações (sem duplicar).
  const createdActions = await syncRecommendationsToActions(
    engine.context,
    engine.recommendations
  );
  const actions = await listActions(userId);

  const mission = pickDailyMission(
    engine.context,
    engine.priorities,
    engine.recommendations,
    actions
  );
  const plan7 = buildPlan7Days(engine.context, engine.priorities, engine.recommendations);
  const plan30 = buildPlan30Days(engine.context);
  const insights = buildProactiveInsights(engine.signals);
  const automations = buildInternalAutomations(engine.signals, engine.recommendations);
  const changes = summarizeChanges(engine.context, engine.signals);

  return {
    context: engine.context,
    signals: engine.signals,
    priorities: engine.priorities,
    recommendations: engine.recommendations,
    actions,
    createdActions: createdActions.map((a) => a.id),
    mission,
    plan7,
    plan30,
    insights,
    automations,
    changes,
    confidence: engine.confidence,
    insufficientData: engine.insufficientData,
  };
}
