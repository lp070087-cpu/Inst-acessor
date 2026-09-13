"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStreak = computeStreak;
exports.streakBonusesGranted = streakBonusesGranted;
exports.grantStreakBonuses = grantStreakBonuses;
exports.getRitmoState = getRitmoState;
exports.recomputeRitmo = recomputeRitmo;
const db_1 = require("@/lib/db");
const db_2 = require("@/lib/ai/db");
const db_3 = require("@/lib/gamification/db");
const xp_1 = require("@/lib/gamification/xp");
const db_4 = require("@/lib/publishing/db");
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
__exportStar(require("./momentum-core"), exports);
const momentum_core_1 = require("./momentum-core");
// ------------------------------------------------------------
// Streak com banco (leitura)
// ------------------------------------------------------------
async function computeStreak(userId) {
    const rows = (await db_3.gp.xpLog.findMany({
        where: { userId },
        select: { createdAt: true },
    }));
    return (0, momentum_core_1.deriveStreak)(rows.map((r) => ({ ...r, source: "", refId: "", amount: 0 })));
}
// ------------------------------------------------------------
// Bônus de sequência (3/7/15/30) — idempotente por source+refId
// ------------------------------------------------------------
/** Marcos de sequência já bonificados (refIds "day-N" em XpLog). */
async function streakBonusesGranted(userId) {
    const logs = (await db_3.gp.xpLog.findMany({
        where: { userId, source: "streak-bonus" },
        select: { refId: true },
    }));
    const out = [];
    for (const l of logs) {
        const n = Number(l.refId.replace(/^day-/, ""));
        if (Number.isFinite(n))
            out.push(n);
    }
    return out.sort((a, b) => a - b);
}
/**
 * Concessão resiliente a corrida: se outra requisição já gravou a MESMA
 * concessão entre o findUnique e o create, o banco rejeita com P2002 — o XP
 * já existe e a operação é tratada como sucesso (idempotente).
 */
async function safeGrant(userId, source, refId, amount) {
    try {
        await (0, xp_1.grantXpAmount)(userId, source, refId, amount);
    }
    catch (err) {
        const code = err?.code;
        if (code !== "P2002")
            throw err;
    }
}
/** Concede os bônus de marcos de sequência atingidos (idempotente). */
async function grantStreakBonuses(userId, streakDays) {
    const granted = new Set(await streakBonusesGranted(userId));
    const out = [];
    for (const day of momentum_core_1.STREAK_BONUS_MILESTONES) {
        if (streakDays >= day && !granted.has(day)) {
            await safeGrant(userId, "streak-bonus", `day-${day}`, momentum_core_1.STREAK_BONUS_XP[day]);
            granted.add(day);
            out.push({ granted: true, day, amount: momentum_core_1.STREAK_BONUS_XP[day] });
        }
    }
    return out;
}
// ------------------------------------------------------------
// Coleta ÚNICA (evidências) — janelas derivadas em memória
// ------------------------------------------------------------
async function gather(userId) {
    const now = new Date();
    const monthStart = (0, momentum_core_1.startOfMonth)(now);
    // A janela SEMANAL pode começar no mês anterior (ex.: hoje 02/set, semana
    // começou 31/ago). O limite inferior das ações precisa cobrir a MENOR das
    // janelas (mês corrente × semana corrente) — as demais derivam em memória.
    const weekStart = (0, momentum_core_1.startOfWeek)(now);
    const actionSince = weekStart.getTime() < monthStart.getTime() ? weekStart : monthStart;
    // Snapshots IG têm reach/engagement; TikTok NÃO — selects separados.
    const [ig, tt, xpRows, copies, ideias, ia, publicacoes] = await Promise.all([
        db_1.prisma.instagramSnapshot.findMany({
            where: { userId },
            orderBy: { capturedAt: "asc" },
            select: { capturedAt: true, followersCount: true, reach: true, engagement: true },
        }),
        db_1.prisma.tikTokSnapshot.findMany({
            where: { userId },
            orderBy: { capturedAt: "asc" },
            select: { capturedAt: true, followersCount: true },
        }),
        db_3.gp.xpLog.findMany({
            where: { userId },
            select: { createdAt: true, source: true, refId: true, amount: true },
        }),
        db_1.prisma.generatedCopy.findMany({
            where: { userId, createdAt: { gte: actionSince } },
            select: { createdAt: true },
        }),
        db_1.prisma.contentIdea.findMany({
            where: { userId, createdAt: { gte: actionSince } },
            select: { createdAt: true },
        }),
        db_2.ai.message.findMany({
            where: { userId, role: "user", createdAt: { gte: actionSince } },
            select: { createdAt: true },
        }),
        db_4.pub.log.findMany({
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
        ig: ig,
        tt: tt,
        xpRows: xpRows,
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
async function getRitmoState(userId) {
    const g = await gather(userId);
    const grantedSet = new Set(g.xpRows
        .filter((r) => r.source.startsWith("ritmo-"))
        .map((r) => `${r.source}:${r.refId}`));
    const bonusesGranted = g.xpRows
        .filter((r) => r.source === "streak-bonus")
        .map((r) => Number(r.refId.replace(/^day-/, "")))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    return (0, momentum_core_1.buildState)(g, grantedSet, bonusesGranted);
}
/**
 * Concede o XP das metas prontas batidas (uma vez por período) + bônus de
 * marcos de sequência. Retorna o estado atualizado. Idempotente por XpLog
 * (`@@unique([userId, source, refId])`). UMA única coleta de evidências —
 * reconciliação e estado compartilham os mesmos dados.
 */
async function recomputeRitmo(userId) {
    const g = await gather(userId);
    const w = (0, momentum_core_1.windows)(g);
    const grantedSet = new Set(g.xpRows
        .filter((r) => r.source.startsWith("ritmo-"))
        .map((r) => `${r.source}:${r.refId}`));
    const bonusesGranted = g.xpRows
        .filter((r) => r.source === "streak-bonus")
        .map((r) => Number(r.refId.replace(/^day-/, "")))
        .filter(Number.isFinite);
    // 1) Concede XP das metas batidas (paralelo, idempotente).
    const completedNow = [];
    const synthetic = [];
    const grantTasks = [];
    for (const band of momentum_core_1.RITMO_BANDS) {
        const win = w[band.period];
        const ev = (0, momentum_core_1.measureBand)(g, band, win.since);
        if (!ev.available)
            continue;
        if (ev.value < band.target)
            continue;
        if (grantedSet.has(`${band.source}:${win.key}`))
            continue;
        grantedSet.add(`${band.source}:${win.key}`);
        completedNow.push({
            cardId: `${band.id}:${win.key}`,
            bandId: band.id,
            title: band.title,
            period: band.period,
            xpReward: band.xp,
        });
        grantTasks.push(safeGrant(userId, band.source, win.key, band.xp).then(() => {
            synthetic.push({ createdAt: new Date(), source: band.source, refId: win.key, amount: band.xp });
        }));
    }
    await Promise.all(grantTasks);
    // 2) Reconcilia streak com as linhas reais + concedidas agora (o primeiro XP
    //    do dia pode ligar a sequência).
    const streakRows = [...g.xpRows, ...synthetic];
    const { streakDays } = (0, momentum_core_1.deriveStreak)(streakRows);
    // 3) Bônus de sequência (idempotente) + espelha em memória.
    const bonusesGrantedNow = [];
    const bonusTasks = [];
    const bonusSet = new Set(bonusesGranted);
    for (const day of momentum_core_1.STREAK_BONUS_MILESTONES) {
        if (streakDays >= day && !bonusSet.has(day)) {
            bonusSet.add(day);
            bonusesGrantedNow.push({ day, amount: momentum_core_1.STREAK_BONUS_XP[day] });
            bonusTasks.push(safeGrant(userId, "streak-bonus", `day-${day}`, momentum_core_1.STREAK_BONUS_XP[day]).then(() => {
                synthetic.push({
                    createdAt: new Date(),
                    source: "streak-bonus",
                    refId: `day-${day}`,
                    amount: momentum_core_1.STREAK_BONUS_XP[day],
                });
            }));
        }
    }
    await Promise.all(bonusTasks);
    // 4) Estado final usa as linhas atualizadas.
    const state = (0, momentum_core_1.buildState)({ ...g, xpRows: streakRows }, grantedSet, [...bonusSet].sort((a, b) => a - b));
    return { completedNow, bonusesGrantedNow, state };
}
