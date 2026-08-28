import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { runGrowthPipeline } from "@/lib/growth-engine";
import { toGrowthHttpError } from "@/lib/growth-engine/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth/engine
 * Pipeline completo do Growth Engine (Parte 2, reutilizado via runGrowthPipeline):
 *   dados reais → sinais → prioridades → recomendações → ações →
 *   missão do dia → planos 7/30 dias → insights proativos.
 * Tudo session-derived (userId da sessão) e owner-checked.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const output = await runGrowthPipeline(userId);

    return NextResponse.json({
      context: output.context,
      signals: output.signals,
      priorities: output.priorities,
      recommendations: output.recommendations,
      actions: output.actions,
      createdActions: output.createdActions,
      mission: output.mission,
      plan7: output.plan7,
      plan30: output.plan30,
      insights: output.insights,
      automations: output.automations,
      changes: output.changes,
      confidence: output.confidence,
      insufficientData: output.insufficientData,
    });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/engine] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}
