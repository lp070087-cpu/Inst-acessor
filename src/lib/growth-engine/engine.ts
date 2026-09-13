import { buildGrowthContext } from "./context";
import { detectSignals } from "./signals";
import { prioritizeSignals } from "./priorities";
import { buildRecommendations } from "./recommendations";
import type {
  GrowthContext,
  GrowthPriority,
  GrowthRecommendation,
  GrowthSignal,
} from "./types";

/**
 * MOTOR OPERACIONAL DE CRESCIMENTO — Fase 8 (Parte 2)
 * =====================================================
 * Pipeline completo:
 *   dados reais → sinais → diagnóstico → prioridade → recomendação →
 *   ação → acompanhamento → resultado → aprendizado.
 *
 * Este módulo é a orquestração pura (não persiste nada). A persistência de
 * ações fica em `actions.ts` (GrowthAction).
 */

export interface EngineOutput {
  context: GrowthContext;
  signals: GrowthSignal[];
  priorities: GrowthPriority[];
  recommendations: GrowthRecommendation[];
  /** confiança geral do motor (0..1) */
  confidence: number;
  /** true se não há dados suficientes para recomendar com segurança */
  insufficientData: boolean;
}

/**
 * Executa o pipeline completo do Growth Engine para um usuário.
 * Todos os dados vêm de fontes reais; ausência → DADO INSUFICIENTE.
 */
export async function runGrowthEngine(userId: string): Promise<EngineOutput> {
  const context = await buildGrowthContext(userId);

  const signals = await detectSignals(context);
  const priorities = prioritizeSignals(context, signals);
  const recommendations = buildRecommendations(context, priorities);

  const hasRealData =
    context.instagram.snapshotCount >= 2 || context.tiktok.snapshotCount >= 2;
  const insufficientData = !hasRealData || recommendations.length === 0;

  return {
    context,
    signals,
    priorities,
    recommendations,
    confidence: context.confidence,
    insufficientData,
  };
}

// Re-exports para o barrel
export { buildGrowthContext } from "./context";
export { detectSignals } from "./signals";
export { prioritizeSignals } from "./priorities";
export { buildRecommendations } from "./recommendations";
