import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import {
  getUserProgress,
  getUserRankSummary,
  getRanking,
  getEvolutionHistory,
  getUserAchievements,
  recomputeGoalProgress,
} from "@/lib/gamification";
import { RankClient } from "@/components/gamification/rank-client";

export const metadata: Metadata = {
  title: "Rank",
  description: "Sua progressão, metas, conquistas e posição no ranking do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function RankPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Dados reais do usuário (nível, ranking, evolução, conquistas, metas).
  const [progress, summary, ranking, evolution, achievements, goalsResult] = await Promise.all([
    getUserProgress(userId),
    getUserRankSummary(userId),
    getRanking(userId, 50),
    getEvolutionHistory(userId, 30),
    getUserAchievements(userId),
    recomputeGoalProgress(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Trophy size={26} className="text-purple" />
          Rank
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Progressão por XP, metas estratégicas, conquistas e sua posição no ranking.
          Tudo derivado de ações reais — nunca inventado.
        </p>
      </div>

      <RankClient
        initial={{
          progress: {
            level: progress.levelInfo.level,
            xp: progress.levelInfo.xp,
            totalXpEarned: progress.levelInfo.totalXpEarned,
            xpInLevel: progress.levelInfo.xpInLevel,
            xpNeededForNext: progress.levelInfo.xpNeededForNext,
            progressToNext: progress.levelInfo.progressToNext,
          },
          summary: {
            position: summary.position,
            totalUsers: summary.totalUsers,
          },
          ranking: {
            entries: ranking.entries,
          },
          evolution: evolution.map((e) => ({ label: e.label, level: e.level, xp: e.xp })),
          achievements: achievements.map((a) => ({
            slug: a.slug,
            title: a.title,
            description: a.description,
            category: a.category,
            tier: a.tier,
            xpReward: a.xpReward,
            threshold: a.threshold,
            unit: a.unit ?? "",
            hidden: a.hidden,
            progress: a.progress,
            unlocked: a.unlocked,
            unlockedAt: a.unlockedAt,
            xpGranted: a.xpGranted,
          })),
          goals: goalsResult.goals.map((g) => ({
            id: g.id,
            category: g.category,
            title: g.title,
            description: g.description ?? "",
            targetValue: g.targetValue,
            currentValue: g.currentValue,
            unit: g.unit ?? "",
            platform: g.platform ?? "",
            status: g.status,
            deadline: g.deadline,
            progressPercent: g.progressPercent,
          })),
          xpLogs: progress.xpLogs.map((l) => ({
            source: l.source,
            refId: l.refId,
            amount: l.amount,
            createdAt: l.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
