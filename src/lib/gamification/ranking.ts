import { prisma } from "@/lib/db";
import { gp } from "@/lib/gamification/db";
import { levelInfoFromXp, rankTierFromXp } from "@/lib/gamification/xp";

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
  /**
   * @username do Instagram conectado, quando existe. Dado REAL do
   * `InstagramProfile` — nunca inventado a partir do nome.
   */
  username: string | null;
  /**
   * Rótulo do RANK GERAL ("Bronze"). Nunca `null`: todos começam no Bronze.
   */
  tierLabel: string;
  /**
   * Nível INTERNO dentro do Rank (1..5 estrelas). Sozinho NÃO identifica o
   * usuário — o par (Rank, Nível) é a identidade. Use `rankLevelLabel`.
   */
  levelWithinRank: number;
  /**
   * Rótulo do par, pronto para exibir: "Bronze • Nível 2". É este campo que a
   * lista/pódio deve mostrar; "Nível 2" sozinho é ambíguo entre os 5 Ranks.
   */
  rankLevelLabel: string;
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

  // @username REAL do Instagram conectado. Fica em tabela separada do nome de
  // exibição, então é lido aqui em vez de derivado — se a conta não estiver
  // conectada, o campo fica `null` e a UI simplesmente não mostra a linha.
  const igProfiles = await prisma.instagramProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, username: true },
    orderBy: { updatedAt: "desc" },
  });
  const userByUser = new Map<string, string>();
  for (const p of igProfiles) {
    // A ordenação desc garante que o primeiro de cada userId seja o mais recente.
    if (!userByUser.has(p.userId) && p.username) userByUser.set(p.userId, p.username);
  }

  const entries: RankingEntry[] = [];
  let myPosition: number | null = null;
  levels.forEach((row, idx) => {
    const r = row as {
      userId: string;
      xp: number;
      level: number;
      totalXpEarned?: number | null;
    };
    const isMe = r.userId === me;
    if (isMe) myPosition = idx + 1;
    // O Rank usa o XP ACUMULADO quando disponível; o ranking já ordena por
    // `xp` (XP corrente), que é o mesmo valor na prática. O par (Rank, Nível)
    // vem do MESMO motor que posiciona o usuário — não existe uma contagem
    // paralela de estrelas para o ranking.
    const tier = rankTierFromXp(r.totalXpEarned ?? r.xp);
    entries.push({
      userId: r.userId,
      name: nameByUser.get(r.userId) ?? "Usuário",
      level: r.level,
      xp: r.xp,
      position: idx + 1,
      isMe,
      username: userByUser.get(r.userId) ?? null,
      tierLabel: tier.label,
      levelWithinRank: tier.level,
      rankLevelLabel: tier.fullLabel,
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
  /**
   * `true` = âncora de partida da janela (XP acumulado ANTES do primeiro log
   * mostrado), não uma ação do usuário. O `xp` é REAL — é o `base` calculado
   * abaixo — mas o rótulo é "Início". Serve para o gráfico ligar a linha ao zero
   * sem começar em cima de um valor alto, que era a origem do "não parte de 0".
   */
  baseline?: boolean;
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
 *
 * PARTIDA EM ZERO (item 3): o `base` acima é REAL, então continua sendo o
 * primeiro valor da série — nunca é substituído por 0 (isso apagaria XP que o
 * usuário de fato ganhou). O que mudou é que ele passou a ser MARCADO como
 * `baseline`, e a UI usa essa marca para desenhar uma âncora em 0 XP ANTES dele.
 * Sem isso a linha nascia em cima de 700/1.240 XP e parecia que o eixo não
 * partia do zero: os dois comportamentos — não apagar dado real e partir do
 * zero — convivem porque a âncora é um ponto de partida declarado, não um log
 * de ganho.
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
  const points = [...byDay.values()];
  // Marca o start da janela. Quando o `base` É zero (conta nova) o primeiro
  // ponto já começa no eixo, e a marca vira redundante — mas é inofensiva: a UI
  // só desenha a âncora se o start não estiver em 0, para não criar dois pontos
  // no mesmo lugar.
  return points.map((p, i) => (i === 0 ? { ...p, baseline: true } : p));
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
