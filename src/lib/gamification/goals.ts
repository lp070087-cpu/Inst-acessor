import { gp } from "@/lib/gamification/db";
import { grantXpAmount } from "@/lib/gamification/xp";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";

/**
 * MOTOR DE METAS — Fase 5
 * =========================
 * Metas estratégicas do usuário (crescimento/engajamento/consistência).
 * O progresso é calculado a partir de DADOS REAIS (dashboard/snapshots),
 * nunca inventado. Ao CONCLUIR uma meta, concede XP (35) UMA vez
 * (idempotente por source+refId).
 */

export const GOAL_CATEGORIES = ["crescimento", "engajamento", "consistencia"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ["ATIVA", "CONCLUIDA", "CANCELADA"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface UserGoalView {
  id: string;
  category: GoalCategory;
  title: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  platform: string | null;
  status: GoalStatus;
  deadline: string | null;
  /** Progresso 0–100 (se targetValue>0). */
  progressPercent: number;
  createdAt: string;
}

function toView(row: {
  id: string;
  category: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  platform: string | null;
  status: string;
  deadline: Date | null;
  createdAt: Date;
}): UserGoalView {
  const target = row.targetValue ?? 0;
  const current = row.currentValue ?? 0;
  const progressPercent =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return {
    id: row.id,
    category: row.category as GoalCategory,
    title: row.title,
    description: row.description,
    targetValue: row.targetValue,
    currentValue: row.currentValue,
    unit: row.unit,
    platform: row.platform,
    status: row.status as GoalStatus,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    progressPercent,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listGoals(userId: string): Promise<UserGoalView[]> {
  const rows = await gp.goal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return (rows as unknown as Parameters<typeof toView>[0][]).map(toView);
}

export async function createGoal(
  userId: string,
  data: {
    category: GoalCategory;
    title: string;
    description?: string;
    targetValue?: number;
    unit?: string;
    platform?: string;
    deadline?: Date;
  }
): Promise<UserGoalView> {
  const created = await gp.goal.create({
    data: {
      userId,
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      targetValue: data.targetValue ?? null,
      currentValue: 0,
      unit: data.unit ?? null,
      platform: data.platform ?? null,
      status: "ATIVA",
      deadline: data.deadline ?? null,
    },
  });
  return toView(created as unknown as Parameters<typeof toView>[0]);
}

export async function getGoal(userId: string, id: string) {
  const row = await gp.goal.findUnique({ where: { id } });
  if (!row || (row as { userId: string }).userId !== userId) return null;
  return toView(row as unknown as Parameters<typeof toView>[0]);
}

export async function updateGoal(
  userId: string,
  id: string,
  data: {
    category?: GoalCategory;
    title?: string;
    description?: string | null;
    targetValue?: number | null;
    unit?: string | null;
    platform?: string | null;
    status?: GoalStatus;
    deadline?: Date | null;
  }
): Promise<UserGoalView | null> {
  const existing = await gp.goal.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;

  const updated = await gp.goal.update({
    where: { id },
    data: {
      ...(data.category ? { category: data.category } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.targetValue !== undefined ? { targetValue: data.targetValue ?? null } : {}),
      ...(data.unit !== undefined ? { unit: data.unit ?? null } : {}),
      ...(data.platform !== undefined ? { platform: data.platform ?? null } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
    },
  });
  return toView(updated as unknown as Parameters<typeof toView>[0]);
}

export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const existing = await gp.goal.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await gp.goal.delete({ where: { id } });
  return true;
}

// ------------------------------------------------------------
// Progresso real por categoria
// ------------------------------------------------------------

/** Calcula o valor real da métrica da meta para o usuário na plataforma. */
async function realCurrentValue(
  userId: string,
  category: GoalCategory,
  platform: string
): Promise<number> {
  if (platform === "tiktok") {
    const d = await getTikTokDashboardData(userId);
    switch (category) {
      case "crescimento":
        return d.followersCount ?? 0;
      case "engajamento":
        return d.cards.likes.value ?? 0;
      case "consistencia":
        return d.snapshotCount;
      default:
        return 0;
    }
  }
  const d = await getDashboardInstagramData(userId);
  switch (category) {
    case "crescimento":
      return d.followersCount ?? 0;
    case "engajamento":
      return d.cards.engagement.value ?? 0;
    case "consistencia":
      return d.snapshotCount;
    default:
      return 0;
  }
}

/**
 * Recalcula o progresso real de TODAS as metas do usuário e conclui as que
 * atingiram a meta. Ao concluir, concede XP (35) UMA vez por meta.
 * Retorna a lista atualizada + quais concluíram agora.
 */
export async function recomputeGoalProgress(userId: string): Promise<{
  goals: UserGoalView[];
  completedNow: string[];
}> {
  const rows = await gp.goal.findMany({
    where: { userId, status: "ATIVA" },
  });
  const completedNow: string[] = [];

  for (const row of rows) {
    const r = row as {
      id: string;
      category: GoalCategory;
      platform: string | null;
      targetValue: number | null;
      currentValue: number | null;
    };
    if (r.targetValue == null || r.targetValue <= 0) continue;
    const platform = r.platform ?? "instagram";
    const real = await realCurrentValue(userId, r.category, platform);
    const reached = real >= r.targetValue;

    if (reached) {
      await gp.goal.update({
        where: { id: r.id },
        data: { currentValue: r.targetValue, status: "CONCLUIDA" },
      });
      // Concede XP da meta concluída (idempotente por source+refId).
      await grantXpAmount(userId, "concluir-meta", r.id, 35);
      completedNow.push(r.id);
    } else {
      await gp.goal.update({
        where: { id: r.id },
        data: { currentValue: real },
      });
    }
  }

  const goals = await listGoals(userId);
  return { goals, completedNow };
}
