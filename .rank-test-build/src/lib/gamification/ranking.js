"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRanking = getRanking;
exports.getUserRankSummary = getUserRankSummary;
exports.getEvolutionHistory = getEvolutionHistory;
const db_1 = require("@/lib/db");
const db_2 = require("@/lib/gamification/db");
const xp_1 = require("@/lib/gamification/xp");
/**
 * Lista o ranking global ordenado por XP (desc). Retorna até `limit` posições.
 * Marca a posição do usuário autenticado (`me`).
 */
async function getRanking(me, limit = 50) {
    const levels = await db_2.gp.level.findMany({
        orderBy: [{ xp: "desc" }, { level: "desc" }],
        take: limit,
    });
    const userIds = levels.map((l) => l.userId);
    const profiles = await db_1.prisma.userProfile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, displayName: true },
    });
    const nameByUser = new Map();
    for (const p of profiles)
        nameByUser.set(p.userId, p.displayName ?? null);
    const entries = [];
    let myPosition = null;
    levels.forEach((row, idx) => {
        const r = row;
        const isMe = r.userId === me;
        if (isMe)
            myPosition = idx + 1;
        entries.push({
            userId: r.userId,
            name: nameByUser.get(r.userId) ?? "Usuário",
            level: r.level,
            xp: r.xp,
            position: idx + 1,
            isMe,
        });
    });
    const totalUsers = await db_2.gp.level.count();
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
async function getUserRankSummary(userId) {
    const lvl = await db_2.gp.level.findUnique({ where: { userId } });
    if (!lvl) {
        return { position: null, totalUsers: await db_2.gp.level.count(), level: 1, xp: 0 };
    }
    const r = lvl;
    const better = await db_2.gp.level.count({
        where: { xp: { gt: r.xp } },
    });
    const totalUsers = await db_2.gp.level.count();
    return { position: better + 1, totalUsers, level: r.level, xp: r.xp };
}
/**
 * Evolução recente do usuário a partir do XpLog (histórico de concessões).
 * Não inventa pontos; cada ponto corresponde a uma concessão real.
 */
async function getEvolutionHistory(userId, take = 30) {
    const logs = await db_2.gp.xpLog.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take,
    });
    let running = 0;
    const points = [];
    for (const log of logs) {
        const l = log;
        running += l.amount;
        const info = (0, xp_1.levelInfoFromXp)(running);
        points.push({
            label: l.createdAt.toISOString(),
            level: info.level,
            xp: running,
        });
    }
    return points;
}
