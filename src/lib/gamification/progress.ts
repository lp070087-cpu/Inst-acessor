import { prisma } from "@/lib/db";
import { gp } from "@/lib/gamification/db";
import { grantXpAmount } from "@/lib/gamification/xp";
import {
  ACHIEVEMENT_CATALOG,
  getAchievementBySlug,
  toAchievementModel,
  type AchievementCatalogEntry,
  type ProgressKind,
} from "@/lib/gamification/achievements";

/**
 * MOTOR DE PROGRESSO DE CONQUISTAS — Fase 5
 * ==========================================
 * Calcula o progresso individual de cada conquista a partir de DADOS REAIS
 * persistidos (tabelas existentes do app). NUNCA inventa métricas nem
 * progredir conquista sem evidência real.
 */

export type ProgressResult = { value: number; available: boolean };

/**
 * Mede o progresso real de uma conquista para o usuário.
 * Cada `ProgressKind` lê a tabela correspondente com `userId`.
 */
export async function computeProgress(
  userId: string,
  kind: ProgressKind
): Promise<ProgressResult> {
  switch (kind) {
    case "copies_criadas": {
      const c = await prisma.generatedCopy.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "ideias_salvas": {
      const c = await prisma.contentIdea.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "drafts_criados": {
      const c = await prisma.socialDraft.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "recomendacoes_aplicadas": {
      const c = await prisma.mentorshipRecommendation.count({
        where: { userId, status: { in: ["APLICADA", "CONCLUIDA"] } },
      });
      return { value: c, available: true };
    }
    case "experimentos_completados": {
      const c = await prisma.growthExperiment.count({
        where: { userId, status: { in: ["CONFIRMED", "REJECTED"] } },
      });
      return { value: c, available: true };
    }
    case "analises_rodadas": {
      const c = await prisma.profileScoreSnapshot.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "snapshots_instagram": {
      const c = await prisma.instagramSnapshot.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "snapshots_tiktok": {
      const c = await prisma.tikTokSnapshot.count({ where: { userId } });
      return { value: c, available: true };
    }
    case "perfil_completo": {
      const p = await prisma.aIProfile.findUnique({ where: { userId } });
      if (!p) return { value: 0, available: true };
      const complete = p != null && Boolean(p.niche && p.objectives);
      return { value: complete ? 1 : 0, available: true };
    }
    case "primeira_semana_ativa": {
      // Dias com qualquer XpLog — mede "uso ativo" (ações reais no app).
      // `select` mínimo + distinct (agregação no banco, evita trazer todas as linhas).
      const logs = await gp.xpLog.findMany({
        where: { userId },
        select: { createdAt: true },
      });
      const days = new Set(
        (logs as { createdAt: Date }[]).map((l) => l.createdAt.toDateString())
      ).size;
      return { value: days, available: true };
    }
    case "frequencia_consistente": {
      // Dias distintos com snapshots Instagram na mesma semana (seg-dom).
      const snapshots = await prisma.instagramSnapshot.findMany({
        where: { userId },
        select: { capturedAt: true },
      });
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
      const days = new Set(
        snapshots
          .map((s) => s.capturedAt)
          .filter((d) => d.getTime() >= startOfWeek.getTime())
          .map((d) => d.toDateString())
      ).size;
      return { value: days, available: true };
    }
    case "desafio_primeiro_nivel": {
      const lvl = await gp.level.findUnique({ where: { userId } });
      return { value: lvl ? (lvl as { level: number }).level : 0, available: true };
    }
    case "desafio_maestria_xp": {
      const lvl = await gp.level.findUnique({ where: { userId } });
      return { value: lvl ? (lvl as { xp: number }).xp : 0, available: true };
    }
    case "desafio_metas_concluidas": {
      const c = await gp.goal.count({ where: { userId, status: "CONCLUIDA" } });
      return { value: c, available: true };
    }
    case "desafio_10_conquistas": {
      const c = await gp.userAchievement.count({ where: { userId, unlocked: true } });
      return { value: c, available: true };
    }
    default: {
      return { value: 0, available: false };
    }
  }
}

// ------------------------------------------------------------
// Seed idempotente do catálogo (executado quando autorizado)
// ------------------------------------------------------------

/**
 * Upsert do catálogo de conquistas na tabela Achievement (global).
 * Idempotente por slug. Chamado pelo seed oficial da Fase 5.
 */
export async function seedAchievements(): Promise<number> {
  let count = 0;
  for (const def of ACHIEVEMENT_CATALOG) {
    const data = {
      title: def.title,
      description: def.description,
      category: def.category,
      xpReward: def.xpReward,
      threshold: def.threshold,
      unit: def.unit,
      tier: def.tier,
      hidden: def.hidden,
      version: def.version,
      active: def.active,
    };
    await gp.achievement.upsert({
      where: { slug: def.slug },
      update: data,
      create: { slug: def.slug, ...data },
    });
    count += 1;
  }
  return count;
}

// ------------------------------------------------------------
// Leitura do estado de conquistas do usuário
// ------------------------------------------------------------

export interface UserAchievementView {
  slug: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  xpReward: number;
  threshold: number;
  unit: string | null;
  hidden: boolean;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  xpGranted: boolean;
}

/**
 * Garante que o usuário tenha uma linha UserAchievement para cada conquista
 * do catálogo (criando o registro global Achievement se necessário).
 */
async function ensureUserAchievements(userId: string): Promise<void> {
  const rows = await gp.userAchievement.findMany({ where: { userId } });
  const existingSlugs: string[] = [];
  for (const row of rows) {
    const r = row as { achievementId: string };
    const ach = await gp.achievement.findUnique({ where: { id: r.achievementId } });
    if (ach) existingSlugs.push((ach as { slug: string }).slug);
  }
  const have = new Set(existingSlugs);

  for (const def of ACHIEVEMENT_CATALOG) {
    if (have.has(def.slug)) continue;
    const ach = await gp.achievement.upsert({
      where: { slug: def.slug },
      update: {},
      create: { ...toAchievementModel(def), slug: def.slug },
    });
    const achievementId = (ach as { id: string }).id;
    await gp.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId } },
      update: {},
      create: { userId, achievementId, progress: 0, unlocked: false, xpGranted: false },
    });
  }
}

/**
 * Retorna a visão completa das conquistas do usuário com progresso real.
 * Opcionalmente só as visíveis (não-desafio).
 */
export async function getUserAchievements(
  userId: string,
  opts?: { onlyVisible?: boolean }
): Promise<UserAchievementView[]> {
  await ensureUserAchievements(userId);

  const userRows = await gp.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });

  const out: UserAchievementView[] = [];
  for (const row of userRows) {
    const r = row as {
      achievementId: string;
      progress: number;
      unlocked: boolean;
      unlockedAt: Date | null;
      xpGranted: boolean;
    };
    const ach = await gp.achievement.findUnique({ where: { id: r.achievementId } });
    if (!ach) continue;
    const a = ach as {
      slug: string;
      title: string;
      description: string;
      category: string;
      tier: string;
      xpReward: number;
      threshold: number;
      unit: string | null;
      hidden: boolean;
    };
    if (opts?.onlyVisible && a.hidden) continue;

    // Recalcula o progresso a partir dos dados reais (fonte de verdade).
    const def = getAchievementBySlug(a.slug);
    let progress = r.progress;
    if (def) {
      const measured = await computeProgress(userId, def.progressKind);
      progress = measured.available ? Math.min(measured.value, a.threshold) : r.progress;
    }

    out.push({
      slug: a.slug,
      title: a.title,
      description: a.description,
      category: a.category,
      tier: a.tier,
      xpReward: a.xpReward,
      threshold: a.threshold,
      unit: a.unit,
      hidden: a.hidden,
      progress,
      unlocked: r.unlocked,
      unlockedAt: r.unlockedAt ? r.unlockedAt.toISOString() : null,
      xpGranted: r.xpGranted,
    });
  }

  // Ordena: desbloqueadas primeiro, depois por categoria/título.
  out.sort((x, y) =>
    x.unlocked === y.unlocked
      ? x.category.localeCompare(y.category) || x.title.localeCompare(y.title)
      : x.unlocked
        ? -1
        : 1
  );
  return out;
}

// ------------------------------------------------------------
// Desbloqueio + recompensa (XP)
// ------------------------------------------------------------

export interface UnlockResult {
  unlockedNow: boolean;
  xpGrantedNow: boolean;
  amount: number;
}

/**
 * Verifica todas as conquistas do usuário e desbloqueia as que atingiram o
 * threshold. Ao desbloquear, concede o XP da recompensa UMA vez
 * (idempotente por source+refId em XpLog).
 */
export async function checkAndUnlockAchievements(userId: string): Promise<UnlockResult> {
  const views = await getUserAchievements(userId);
  let unlockedNow = false;
  let xpGrantedNow = false;
  let totalAmount = 0;

  for (const v of views) {
    if (v.unlocked || v.progress < v.threshold) continue;

    const ach = await gp.achievement.findUnique({ where: { slug: v.slug } });
    if (!ach) continue;
    const achId = (ach as { id: string }).id;
    const row = await gp.userAchievement.findFirst({
      where: { userId, achievementId: achId },
    });
    if (!row) continue;

    await gp.userAchievement.update({
      where: { id: (row as { id: string }).id },
      data: { unlocked: true, unlockedAt: new Date(), xpGranted: true },
    });
    unlockedNow = true;
    xpGrantedNow = true;
    totalAmount += v.xpReward;

    // Concede o XP da conquista (idempotente por source+refId).
    // amount = xpReward real (5–100 conforme a dificuldade da conquista).
    await grantXpAmount(userId, "conquista-desbloqueada", v.slug, v.xpReward);
  }

  return { unlockedNow, xpGrantedNow, amount: totalAmount };
}

// Re-export usado por outros módulos.
export { ACHIEVEMENT_CATALOG, getAchievementBySlug, toAchievementModel };
export type { AchievementCatalogEntry, ProgressKind };
