"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XP_SOURCES = exports.XP_VALUES = void 0;
exports.stableRefId = stableRefId;
exports.xpForSource = xpForSource;
exports.xpToNextLevel = xpToNextLevel;
exports.xpRequiredForLevel = xpRequiredForLevel;
exports.levelInfoFromXp = levelInfoFromXp;
exports.grantXpAmount = grantXpAmount;
exports.grantXp = grantXp;
exports.getUserProgress = getUserProgress;
const db_1 = require("@/lib/gamification/db");
/**
 * MOTOR DE XP — Fase 5
 * =====================
 * Concede XP por AÇÕES REAIS, de forma IDEMPOTENTE (nunca duas vezes pela
 * mesma ação), recalcula nível e mantém auditoria completa em XpLog.
 *
 * Regras (Knowledge Engine — Módulo 28):
 * - XP ~5–100 conforme dificuldade (valores versionáveis por fonte).
 * - Mesmo `source + refId` só concede XP UMA vez (anti-duplicidade real).
 * - Toda concessão fica registrada em XpLog (histórico/auditoria).
 */
exports.XP_VALUES = {
    "salvar-copy": 10,
    "gerar-copy": 5,
    "salvar-ideia": 10,
    "gerar-ideia": 5,
    "criar-rascunho": 10,
    "analisar-desempenho": 10,
    "calcular-score": 15,
    "executar-recomendacao": 40,
    "completar-experimento": 50,
    "concluir-meta": 35,
    "sincronizar-instagram": 15,
    "sincronizar-tiktok": 15,
    "concluir-onboarding": 20,
    "melhorar-perfil": 15,
    "planejar-conteudo": 10, // Fase 6: criar/duplicar conteúdo no calendário
    "conquista-desbloqueada": 0, // XP real vem do xpReward da conquista (5–100)
    "concluir-acao-crescimento": 15, // Fase 8: concluir GrowthAction real
};
/** Fontes válidas para validação em APIs. */
exports.XP_SOURCES = Object.keys(exports.XP_VALUES);
/**
 * RefId estável a partir de um conteúdo (para ações sem id persistido,
 * ex.: "gerar copy/ideia"). Determinístico: o MESMO conteúdo gera o MESMO
 * refId — a mesma ação nunca concede XP duas vezes.
 */
function stableRefId(input) {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36) + "-" + input.length.toString(36);
}
/** Retorna o XP configurado para uma fonte (fallback seguro). */
function xpForSource(source) {
    return exports.XP_VALUES[source] ?? 5;
}
// ------------------------------------------------------------
// Curva de nível — progressão
// ------------------------------------------------------------
/** XP necessário para ir do nível `level` ao `level + 1`. */
function xpToNextLevel(level) {
    // Base 100; cresce 25 por nível. Nível 1→2 = 100, 2→3 = 125, ...
    return 100 + (level - 1) * 25;
}
/** XP necessário para chegar ao nível dado (soma da curva). */
function xpRequiredForLevel(level) {
    if (level <= 1)
        return 0;
    let total = 0;
    for (let l = 1; l < level; l++)
        total += xpToNextLevel(l);
    return total;
}
/** Calcula nível e progresso a partir do XP total. */
function levelInfoFromXp(totalXp) {
    let level = 1;
    let remaining = totalXp;
    while (remaining >= xpToNextLevel(level)) {
        remaining -= xpToNextLevel(level);
        level += 1;
    }
    return {
        level,
        xpInLevel: remaining,
        xpNeededForNext: xpToNextLevel(level),
    };
}
// ------------------------------------------------------------
// Garantir linha UserLevel
// ------------------------------------------------------------
async function ensureLevel(userId) {
    const existing = await db_1.gp.level.findUnique({ where: { userId } });
    if (existing)
        return existing;
    const created = await db_1.gp.level.create({
        data: { userId, xp: 0, level: 1, totalXpEarned: 0 },
    });
    return created;
}
/**
 * Concede XP por uma ação real, com valor explícito. Idempotente:
 * se `userId + source + refId` já existir em XpLog, NÃO concede de novo.
 */
async function grantXpAmount(userId, source, refId, amount) {
    // Idempotência: procura antes de criar (evita corrida de duplicidade).
    const existing = await db_1.gp.xpLog.findUnique({
        where: { userId_source_refId: { userId, source, refId } },
    });
    if (existing) {
        const lvl = await ensureLevel(userId);
        return {
            granted: false,
            amount,
            level: lvl.level,
            levelUp: false,
            totalXp: lvl.xp,
            alreadyGranted: true,
        };
    }
    // Auditoria da concessão (antes de atualizar o nível — atomicidade lógica).
    await db_1.gp.xpLog.create({
        data: { userId, source, refId, amount },
    });
    // Atualiza XP total e recalcula nível.
    const current = await ensureLevel(userId);
    const newTotal = current.xp + amount;
    const { level: newLevel } = levelInfoFromXp(newTotal);
    const leveledUp = newLevel > current.level;
    await db_1.gp.level.update({
        where: { userId },
        data: {
            xp: newTotal,
            level: newLevel,
            totalXpEarned: current.totalXpEarned + amount,
            ...(leveledUp ? { lastLevelUpAt: new Date() } : {}),
        },
    });
    return {
        granted: true,
        amount,
        level: newLevel,
        levelUp: leveledUp,
        totalXp: newTotal,
        alreadyGranted: false,
    };
}
/**
 * Concede XP por uma ação real usando o valor padrão da tabela XP_VALUES.
 * Idempotente: se `userId + source + refId` já existir, NÃO concede de novo.
 */
async function grantXp(userId, source, refId) {
    return grantXpAmount(userId, source, refId, xpForSource(source));
}
/** Lê o estado completo de XP do usuário (nível + auditoria recente). */
async function getUserProgress(userId) {
    const lvl = await ensureLevel(userId);
    const { level, xpInLevel, xpNeededForNext } = levelInfoFromXp(lvl.xp);
    const logs = await db_1.gp.xpLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    const progress = (xpInLevel / xpNeededForNext) * 100;
    return {
        levelInfo: {
            level,
            xp: lvl.xp,
            totalXpEarned: lvl.totalXpEarned,
            xpInLevel,
            xpNeededForNext,
            progressToNext: Math.min(100, Math.round(progress * 100) / 100),
            xpTotal: lvl.xp,
        },
        xpLogs: logs.map((l) => ({
            source: l.source,
            refId: l.refId,
            amount: l.amount,
            createdAt: l.createdAt,
        })),
    };
}
