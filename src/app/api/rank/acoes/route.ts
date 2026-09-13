import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getUserProgress, XP_SOURCES, xpForSource } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET /api/rank/acoes — histórico/auditoria das concessões de XP (Fase 5).
 * Protegido por sessão. Somente dados do usuário autenticado.
 * Retorna também o catálogo de fontes (para a UI explicar cada ação).
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const progress = await getUserProgress(userId);

    return NextResponse.json({
      logs: progress.xpLogs.map((l) => ({
        source: l.source,
        refId: l.refId,
        amount: l.amount,
        createdAt: l.createdAt.toISOString(),
      })),
      sources: XP_SOURCES.map((source) => ({
        source,
        xp: xpForSource(source),
      })),
    });
  } catch (err) {
    console.error("[rank/acoes] erro ao carregar", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico de XP." },
      { status: 500 }
    );
  }
}
