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

function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Evolução recente do usuário a partir do XpLog (histórico de concessões).
 * Não inventa pontos.
 *
 * - Agrega todas as ações de um MESMO dia em um único ponto (o último valor
 *   acumulado do dia) — evita vários rótulos "03/09" repetidos no eixo X.
 * - Usa como baseline o XP total real (UserLevel.xp) menos a soma da janela:
 *   assim o primeiro ponto já representa o XP acumulado real antes da janela,
 *   e a linha mostra o XP acumulado REAL ao longo do tempo.
 * - Se a janela inteira cair num único dia, retorna 1 ponto (a UI decide como
 *   exibir sem inventar histórico).
 */
export async function getEvolutionHistory(userId: string, take = 30): Promise<EvolutionPoint[]> {
  const lvl = await gp.level.findUnique({ where: { userId } });
  const logsDesc = await gp.xpLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const logs = [...(logsDesc as { amount: number; createdAt: Date }[])].reverse();

  const windowSum = logs.reduce((s, l) => s + l.amount, 0);
  const totalXp = (lvl as { xp: number } | null)?.xp ?? 0;
  const base = Math.max(0, totalXp - windowSum);

  const byDay = new Map<string, EvolutionPoint>();
  let running = base;
  for (const log of logs) {
    running += log.amount;
    const info = levelInfoFromXp(running);
    const key = localDateKey(log.createdAt);
    byDay.set(key, {
      label: log.createdAt.toISOString(),
      level: info.level,
      xp: running,
    });
  }
  return [...byDay.values()];
}

// ------------------------------------------------------------
// Resumo social real p/ o topo do Rank (seguidores/crescimento/IG)
// ------------------------------------------------------------

export interface RankSocialSummary {
  /** Seguidores reais mais recentes (snapshot atual ou perfil IG). */
  followers: number | null;
  /** Ganho real de seguidores nos últimos 30 dias (snapshots). */
  growth30d: number | null;
  instagramConnected: boolean;
  instagramUsername: string | null;
}

/**
 * Lê dados sociais REAIS do usuário para o resumo superior do Rank.
 * Nunca inventa número: sem conta/snapshot → null (a UI mostra "—").
 */
export async function getRankSocialSummary(userId: string): Promise<RankSocialSummary> {
  const profile = await prisma.instagramProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { username: true, followersCount: true },
  });

  const snapshots = await prisma.instagramSnapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, followersCount: true },
  });

  const latest = snapshots[snapshots.length - 1] ?? null;
  const current = latest?.followersCount ?? profile?.followersCount ?? null;

  let growth30d: number | null = null;
  if (snapshots.length > 0 && current != null) {
    const cutoff = Date.now() - 30 * 864e5;
    let past: { followersCount: number | null } | null = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].capturedAt.getTime() <= cutoff) {
        past = snapshots[i];
        break;
      }
    }
    if (past?.followersCount != null) growth30d = current - past.followersCount;
  }

  return {
    followers: current,
    growth30d,
    instagramConnected: Boolean(profile?.username || profile?.followersCount != null),
    instagramUsername: profile?.username ?? null,
  };
}
