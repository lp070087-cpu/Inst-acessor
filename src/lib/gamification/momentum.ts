import { prisma } from "@/lib/db";
import { ai } from "@/lib/ai/db";
import { gp } from "@/lib/gamification/db";
import { grantXpAmount } from "@/lib/gamification/xp";
import { pub } from "@/lib/publishing/db";

/**
 * IMPULSO / RITMO — rodada #274 (mantém a estética do Rank)
 * ==========================================================
 * Metas PRONTAS (diárias/semanais/mensais) + XP + sequência/streak.
 *
 * Este arquivo concentra as funções que tocam banco/Prisma. Todo o núcleo
 * puro (janelas, configuração das metas, streak, derivadores de snapshot,
 * montagem de cards/estado) vive em `momentum-core.ts` e é re-exportado
 * daqui — o barrel `gamification/index.ts` continua expondo o MESMO contrato.
 *
 * Princípios (ESCOPO-OFICIAL + regras da DONA):
 * - Nenhum dado inventado: cada progresso mede uma tabela REAL (XpLog,
 *   InstagramSnapshot/TikTokSnapshot, GeneratedCopy, ContentIdea, AIMessage,
 *   PublishLog). Sem evidência → current 0 e available=false (estado
 *   "sem-dados"), nunca um número fabricado.
 * - Nenhuma duplicidade de XP: a MESMA meta no MESMO período NUNCA paga duas
 *   vezes — reusa XpLog `@@unique([userId, source, refId])`. GET repetido,
 *   refresh, abas múltiplas, render server-side e retry NÃO geram XP extra.
 * - SEM mudança de schema: metas de cadência são computadas em tempo de leitura
 *   (janelas dia/semana/mês) e NUNCA gravadas em UserGoal. Streak deriva de
 *   XpLog (mesmo padrão da conquista "primeira_semana_ativa").
 *
 * Desempenho: UMA coleta única por requisição — séries de snapshots (IG e
 * TikTok), XpLog completo, e contagens de ações desde o início do mês. Todas
 * as janelas (dia/semana/mês) são derivadas EM MEMÓRIA dessas mesmas linhas.
 */

export * from "./momentum-core";
import {
  startOfMonth,
  startOfWeek,
  deriveStreak,
  buildState,
  windows,
  measureBand,
  RITMO_BANDS,
  STREAK_BONUS_MILESTONES,
  STREAK_BONUS_XP,
} from "./momentum-core";
import type { RitmoPeriod, RitmoState } from "./momentum-core";
import type { Gather } from "./momentum-core";
import type { XpRowLike, SnapshotRow } from "./momentum-core";

// ------------------------------------------------------------
// Streak com banco (leitura)
// ------------------------------------------------------------

export async function computeStreak(userId: string): Promise<{
  streakDays: number;
  activeWeekStreak: number;
}> {
  const rows = (await gp.xpLog.findMany({
    where: { userId },
    select: { createdAt: true },
  })) as { createdAt: Date }[];
  return deriveStreak(rows.map((r) => ({ ...r, source: "", refId: "", amount: 0 })));
}

// ------------------------------------------------------------
// Bônus de sequência (3/7/15/30) — idempotente por source+refId
// ------------------------------------------------------------

/** Marcos de sequência já bonificados (refIds "day-N" em XpLog). */
export async function streakBonusesGranted(userId: string): Promise<number[]> {
  const logs = (await gp.xpLog.findMany({
    where: { userId, source: "streak-bonus" },
    select: { refId: true },
  })) as { refId: string }[];
  const out: number[] = [];
  for (const l of logs) {
    const n = Number(l.refId.replace(/^day-/, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Concessão resiliente a corrida: se outra requisição já gravou a MESMA
 * concessão entre o findUnique e o create, o banco rejeita com P2002 — o XP
 * já existe e a operação é tratada como sucesso (idempotente).
 */
async function safeGrant(
  userId: string,
  source: string,
  refId: string,
  amount: number
): Promise<void> {
  try {
    await grantXpAmount(userId, source, refId, amount);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2002") throw err;
  }
}

/** Concede os bônus de marcos de sequência atingidos (idempotente). */
export async function grantStreakBonuses(
  userId: string,
  streakDays: number
): Promise<{ granted: boolean; day: number; amount: number }[]> {
  const granted = new Set(await streakBonusesGranted(userId));
  const out: { granted: boolean; day: number; amount: number }[] = [];
  for (const day of STREAK_BONUS_MILESTONES) {
    if (streakDays >= day && !granted.has(day)) {
      await safeGrant(userId, "streak-bonus", `day-${day}`, STREAK_BONUS_XP[day]);
      granted.add(day);
      out.push({ granted: true, day, amount: STREAK_BONUS_XP[day] });
    }
  }
  return out;
}

// ------------------------------------------------------------
// Coleta ÚNICA (evidências) — janelas derivadas em memória
// ------------------------------------------------------------

async function gather(userId: string): Promise<Gather> {
  const now = new Date();
  const monthStart = startOfMonth(now);

  // A janela SEMANAL pode começar no mês anterior (ex.: hoje 02/set, semana
  // começou 31/ago). O limite inferior das ações precisa cobrir a MENOR das
  // janelas (mês corrente × semana corrente) — as demais derivam em memória.
  const weekStart = startOfWeek(now);
  const actionSince =
    weekStart.getTime() < monthStart.getTime() ? weekStart : monthStart;

  // Snapshots IG têm reach/engagement; TikTok NÃO — selects separados.
  const [ig, tt, xpRows, copies, ideias, ia, publicacoes] = await Promise.all([
    prisma.instagramSnapshot.findMany({
      where: { userId },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, followersCount: true, reach: true, engagement: true },
    }),
    prisma.tikTokSnapshot.findMany({
      where: { userId },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, followersCount: true },
    }),
    gp.xpLog.findMany({
      where: { userId },
      select: { createdAt: true, source: true, refId: true, amount: true },
    }),
    prisma.generatedCopy.findMany({
      where: { userId, createdAt: { gte: actionSince } },
      select: { createdAt: true },
    }),
    prisma.contentIdea.findMany({
      where: { userId, createdAt: { gte: actionSince } },
      select: { createdAt: true },
    }),
    ai.message.findMany({
      where: { userId, role: "user", createdAt: { gte: actionSince } },
      select: { createdAt: true },
    }),
    pub.log.findMany({
      where: {
        userId,
        operation: "publish",
        status: "success",
        createdAt: { gte: actionSince },
      },
      select: { createdAt: true },
    }),
  ]);

  return {
    now,
    ig: ig as unknown as SnapshotRow[],
    tt: tt as unknown as SnapshotRow[],
    xpRows: xpRows as unknown as XpRowLike[],
    actions: {
      copies: copies.map((r) => r.createdAt),
      ideias: ideias.map((r) => r.createdAt),
      ia: ia.map((r) => r.createdAt),
      publicacoes: publicacoes.map((r) => r.createdAt),
    },
    monthStart,
  };
}

// ------------------------------------------------------------
// Estado completo de ritmo (leitura)
// ------------------------------------------------------------

export async function getRitmoState(userId: string): Promise<RitmoState> {
  const g = await gather(userId);
  const grantedSet = new Set(
    g.xpRows
      .filter((r) => r.source.startsWith("ritmo-"))
      .map((r) => `${r.source}:${r.refId}`)
  );
  const bonusesGranted = g.xpRows
    .filter((r) => r.source === "streak-bonus")
    .map((r) => Number(r.refId.replace(/^day-/, "")))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return buildState(g, grantedSet, bonusesGranted);
}

// ------------------------------------------------------------
// Reconciliação de XP (chamada por GET /api/rank e página /rank)
// ------------------------------------------------------------

export interface RitmoReconcileResult {
  completedNow: {
    cardId: string;
    bandId: string;
    title: string;
    period: RitmoPeriod;
    xpReward: number;
  }[];
  bonusesGrantedNow: { day: number; amount: number }[];
  state: RitmoState;
}

/**
 * Concede o XP das metas prontas batidas (uma vez por período) + bônus de
 * marcos de sequência. Retorna o estado atualizado. Idempotente por XpLog
 * (`@@unique([userId, source, refId])`). UMA única coleta de evidências —
 * reconciliação e estado compartilham os mesmos dados.
 */
export async function recomputeRitmo(userId: string): Promise<RitmoReconcileResult> {
  const g = await gather(userId);
  const w = windows(g);
  const grantedSet = new Set(
    g.xpRows
      .filter((r) => r.source.startsWith("ritmo-"))
      .map((r) => `${r.source}:${r.refId}`)
  );
  const bonusesGranted = g.xpRows
    .filter((r) => r.source === "streak-bonus")
    .map((r) => Number(r.refId.replace(/^day-/, "")))
    .filter(Number.isFinite);

  // 1) Concede XP das metas batidas (paralelo, idempotente).
  const completedNow: RitmoReconcileResult["completedNow"] = [];
  const synthetic: XpRowLike[] = [];
  const grantTasks: Promise<unknown>[] = [];

  for (const band of RITMO_BANDS) {
    const win = w[band.period];
    const ev = measureBand(g, band, win.since);
    if (!ev.available) continue;
    if (ev.value < band.target) continue;
    if (grantedSet.has(`${band.source}:${win.key}`)) continue;

    grantedSet.add(`${band.source}:${win.key}`);
    completedNow.push({
      cardId: `${band.id}:${win.key}`,
      bandId: band.id,
      title: band.title,
      period: band.period,
      xpReward: band.xp,
    });
    grantTasks.push(
      safeGrant(userId, band.source, win.key, band.xp).then(() => {
        synthetic.push({ createdAt: new Date(), source: band.source, refId: win.key, amount: band.xp });
      })
    );
  }

  await Promise.all(grantTasks);

  // 2) Reconcilia streak com as linhas reais + concedidas agora (o primeiro XP
  //    do dia pode ligar a sequência).
  const streakRows = [...g.xpRows, ...synthetic];
  const { streakDays } = deriveStreak(streakRows);

  // 3) Bônus de sequência (idempotente) + espelha em memória.
  const bonusesGrantedNow: { day: number; amount: number }[] = [];
  const bonusTasks: Promise<unknown>[] = [];
  const bonusSet = new Set(bonusesGranted);
  for (const day of STREAK_BONUS_MILESTONES) {
    if (streakDays >= day && !bonusSet.has(day)) {
      bonusSet.add(day);
      bonusesGrantedNow.push({ day, amount: STREAK_BONUS_XP[day] });
      bonusTasks.push(
        safeGrant(userId, "streak-bonus", `day-${day}`, STREAK_BONUS_XP[day]).then(() => {
          synthetic.push({
            createdAt: new Date(),
            source: "streak-bonus",
            refId: `day-${day}`,
            amount: STREAK_BONUS_XP[day],
          });
        })
      );
    }
  }
  await Promise.all(bonusTasks);

  // 4) Estado final usa as linhas atualizadas.
  const state = buildState(
    { ...g, xpRows: streakRows },
    grantedSet,
    [...bonusSet].sort((a, b) => a - b)
  );

  return { completedNow, bonusesGrantedNow, state };
}
