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
import { recomputeRitmo, getDisplayNameInfo } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET /api/rank — dados consolidados da página /rank (Fase 5).
 * Protegido por sessão. Todos os dados pertencem ao usuário autenticado.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Impulso/Ritmo (rodada #274) é reconciliado PRIMEIRO: concede o XP das
    // metas prontas batidas (uma vez por período) + bônus de sequência, para
    // que as leituras abaixo (progresso/ranking/evolução) já reflitam o XP.
    const ritmo = await recomputeRitmo(userId);

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

    // Nome exibido (rodada #274): preferência do usuário com fallback real.
    const displayNameInfo = await getDisplayNameInfo(userId);

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
        entries: ranking.entries.map((e) => (e.isMe ? { ...e, name: displayNameInfo.value } : e)),
        summary: ranking.summary,
      },
      summary,
      evolution: evolution.map((e) => ({ label: e.label, level: e.level, xp: e.xp })),
      achievements,
      goals,
      completedNow: recomputed.completedNow,
      momentum: {
        cards: ritmo.state.cards,
        streakDays: ritmo.state.streakDays,
        activeWeekStreak: ritmo.state.activeWeekStreak,
        nextStreakBonus: ritmo.state.nextStreakBonus,
        todayXp: ritmo.state.todayXp,
        bonusXpGranted: ritmo.state.bonusXpGranted,
        completedNow: ritmo.completedNow,
        bonusesGrantedNow: ritmo.bonusesGrantedNow,
      },
      displayName: {
        source: displayNameInfo.source,
        value: displayNameInfo.value,
        storedSource: displayNameInfo.storedSource,
        hasInstagram: displayNameInfo.hasInstagram,
      },
    });
  } catch (err) {
    console.error("[rank] erro ao carregar", err);
    return NextResponse.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
