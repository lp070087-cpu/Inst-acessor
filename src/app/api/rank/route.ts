import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  getUserProgress,
  getUserRankSummary,
  getRanking,
  getEvolutionHistory,
} from "@/lib/gamification";
import { getUserAchievements } from "@/lib/gamification";
import { recomputeGoalProgress } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET /api/rank — dados consolidados da página /rank (Fase 5).
 * Protegido por sessão. Todos os dados pertencem ao usuário autenticado.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Nível/XP + auditoria recente
    const progress = await getUserProgress(userId);

    // Ranking + posição
    const ranking = await getRanking(userId, 50);
    const summary = await getUserRankSummary(userId);

    // Evolução (histórico de XP)
    const evolution = await getEvolutionHistory(userId, 30);

    // Conquistas (progresso individual)
    const achievements = await getUserAchievements(userId, { onlyVisible: false });

    // Metas: recalcula progresso real (conclui metas atingidas, concede XP)
    const recomputed = await recomputeGoalProgress(userId);
    const goals = recomputed.goals;

    return NextResponse.json({
      progress: {
        level: progress.levelInfo.level,
        xp: progress.levelInfo.xp,
        totalXpEarned: progress.levelInfo.totalXpEarned,
        xpInLevel: progress.levelInfo.xpInLevel,
        xpNeededForNext: progress.levelInfo.xpNeededForNext,
        progressToNext: progress.levelInfo.progressToNext,
        xpTotal: progress.levelInfo.xpTotal,
      },
      xpLogs: progress.xpLogs.map((l) => ({
        source: l.source,
        refId: l.refId,
        amount: l.amount,
        createdAt: l.createdAt.toISOString(),
      })),
      ranking: {
        entries: ranking.entries,
        summary: ranking.summary,
      },
      summary,
      evolution: evolution.map((e) => ({ label: e.label, level: e.level, xp: e.xp })),
      achievements,
      goals,
      completedNow: recomputed.completedNow,
    });
  } catch (err) {
    console.error("[rank] erro ao carregar", err);
    return NextResponse.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
