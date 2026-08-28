import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getUserAchievements, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * API de Conquistas (Fase 5):
 *   GET  /api/rank/conquistas?visiveis=1 → lista conquistas + progresso individual
 *   POST /api/rank/conquistas            → dispara verificação de desbloqueio
 *                                          (concede XP da conquista UMA vez)
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const onlyVisible = url.searchParams.get("visiveis") === "1";

    const achievements = await getUserAchievements(userId, {
      onlyVisible: onlyVisible || undefined,
    });

    return NextResponse.json({ achievements });
  } catch (err) {
    console.error("[rank/conquistas] erro ao carregar", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as conquistas." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const result = await checkAndUnlockAchievements(userId);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[rank/conquistas] erro ao verificar", err);
    return NextResponse.json(
      { error: "Não foi possível verificar conquistas." },
      { status: 500 }
    );
  }
}
