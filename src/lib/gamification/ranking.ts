import { prisma } from "@/lib/db";
import { gp } from "@/lib/gamification/db";
import { levelInfoFromXp } from "@/lib/gamification/xp";

/**
 * RANKING — Fase 5
 * =================
 * Ranking por XP (evolução do usuário vs. demais usuários do Inst Acessor).
 * Baseia-se em UserLevel (dados reais persistidos). Nenhum número inventado.
 */

export interface RankingEntry {
  userId: string;
  name: string | null;
  level: number;
  xp: number;
  position: number;
  isMe: boolean;
}

export interface UserRankSummary {
  position: number | null;
  totalUsers: number;
  level: number;
  xp: number;
}

/**
 * Lista o ranking global ordenado por XP (desc). Retorna até `limit` posições.
 * Marca a posição do usuário autenticado (`me`).
 */
export async function getRanking(
  me: string,
  limit = 50
): Promise<{ entries: RankingEntry[]; summary: UserRankSummary }> {
  const levels = await gp.level.findMany({
    orderBy: [{ xp: "desc" }, { level: "desc" }],
    take: limit,
  });
  const userIds = levels.map((l) => (l as { userId: string }).userId);

  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true },
  });
  const nameByUser = new Map<string, string | null>();
  for (const p of profiles) nameByUser.set(p.userId, p.displayName ?? null);

  const entries: RankingEntry[] = [];
  let myPosition: number | null = null;
  levels.forEach((row, idx) => {
    const r = row as { userId: string; xp: number; level: number };
    const isMe = r.userId === me;
    if (isMe) myPosition = idx + 1;
    entries.push({
      userId: r.userId,
      name: nameByUser.get(r.userId) ?? "Usuário",
      level: r.level,
      xp: r.xp,
      position: idx + 1,
      isMe,
    });
  });

  const totalUsers = await gp.level.count();
  return {
    entries,
    summary: {
      position: myPosition,
      totalUsers,
      level: entries.find((e) => e.isMe)?.level ?? 1,
      xp: entries.find((e) => e.isMe)?.xp ?? 0,
    },
  };
}

/**
 * Resumo do rank do usuário: posição (1-based) + total de usuários.
 * Se o usuário ainda não tem linha (nunca recebeu XP), fica fora do ranking.
 */
export async function getUserRankSummary(userId: string): Promise<UserRankSummary> {
  const lvl = await gp.level.findUnique({ where: { userId } });
  if (!lvl) {
    return { position: null, totalUsers: await gp.level.count(), level: 1, xp: 0 };
  }
  const r = lvl as { xp: number; level: number };
  const better = await gp.level.count({
    where: { xp: { gt: r.xp } },
  });
  const totalUsers = await gp.level.count();
  return { position: better + 1, totalUsers, level: r.level, xp: r.xp };
}

// ------------------------------------------------------------
// Evolução do usuário
// ------------------------------------------------------------

export interface EvolutionPoint {
  label: string;
  level: number;
  xp: number;
}

/**
 * Evolução recente do usuário a partir do XpLog (histórico de concessões).
 * Não inventa pontos; cada ponto corresponde a uma concessão real.
 */
export async function getEvolutionHistory(userId: string, take = 30): Promise<EvolutionPoint[]> {
  const logs = await gp.xpLog.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take,
  });

  let running = 0;
  const points: EvolutionPoint[] = [];
  for (const log of logs) {
    const l = log as { amount: number; createdAt: Date };
    running += l.amount;
    const info = levelInfoFromXp(running);
    points.push({
      label: l.createdAt.toISOString(),
      level: info.level,
      xp: running,
    });
  }
  return points;
}
