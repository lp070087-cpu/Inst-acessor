import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateWeeklyPlanWithAI, buildWeeklyPlan } from "@/lib/planning";

export const dynamic = "force-dynamic";

/**
 * FASE 6 — PLANO SEMANAL ASSISTIDO
 * =================================
 * GET /api/calendar/weekly-plan — plano semanal personalizado
 * (contexto real: perfil, snapshots, AIProfile, metas, experimentos).
 *
 * Query param `mode=ai` ativa a IA (se configurada); padrão determinístico.
 * NUNCA publica nada. DADO INSUFICIENTE quando faltar contexto real.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    const { plan, aiUsed } =
      mode === "ai"
        ? await generateWeeklyPlanWithAI(userId)
        : { plan: await buildWeeklyPlan(userId), aiUsed: false };

    return NextResponse.json({
      ...plan,
      aiUsed,
    });
  } catch (err) {
    console.error("[weekly-plan] erro ao gerar plano", err);
    return NextResponse.json({ error: "Não foi possível gerar o plano semanal." }, { status: 500 });
  }
}
