"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOAL_STATUSES = exports.GOAL_CATEGORIES = void 0;
exports.listGoals = listGoals;
exports.createGoal = createGoal;
exports.getGoal = getGoal;
exports.updateGoal = updateGoal;
exports.deleteGoal = deleteGoal;
exports.recomputeGoalProgress = recomputeGoalProgress;
const db_1 = require("@/lib/gamification/db");
const xp_1 = require("@/lib/gamification/xp");
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
/**
 * MOTOR DE METAS — Fase 5
 * =========================
 * Metas estratégicas do usuário (crescimento/engajamento/consistência).
 * O progresso é calculado a partir de DADOS REAIS (dashboard/snapshots),
 * nunca inventado. Ao CONCLUIR uma meta, concede XP (35) UMA vez
 * (idempotente por source+refId).
 */
exports.GOAL_CATEGORIES = ["crescimento", "engajamento", "consistencia"];
exports.GOAL_STATUSES = ["ATIVA", "CONCLUIDA", "CANCELADA"];
function toView(row) {
    const target = row.targetValue ?? 0;
    const current = row.currentValue ?? 0;
    const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
        id: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        targetValue: row.targetValue,
        currentValue: row.currentValue,
        unit: row.unit,
        platform: row.platform,
        status: row.status,
        deadline: row.deadline ? row.deadline.toISOString() : null,
        progressPercent,
        createdAt: row.createdAt.toISOString(),
    };
}
async function listGoals(userId) {
    const rows = await db_1.gp.goal.findMany({
        where: { userId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toView);
}
async function createGoal(userId, data) {
    const created = await db_1.gp.goal.create({
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
    return toView(created);
}
async function getGoal(userId, id) {
    const row = await db_1.gp.goal.findUnique({ where: { id } });
    if (!row || row.userId !== userId)
        return null;
    return toView(row);
}
async function updateGoal(userId, id, data) {
    const existing = await db_1.gp.goal.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    const updated = await db_1.gp.goal.update({
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
    return toView(updated);
}
async function deleteGoal(userId, id) {
    const existing = await db_1.gp.goal.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await db_1.gp.goal.delete({ where: { id } });
    return true;
}
// ------------------------------------------------------------
// Progresso real por categoria
// ------------------------------------------------------------
/** Calcula o valor real da métrica da meta para o usuário na plataforma. */
async function realCurrentValue(userId, category, platform) {
    if (platform === "tiktok") {
        const d = await (0, tiktok_data_1.getTikTokDashboardData)(userId);
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
    const d = await (0, instagram_data_1.getDashboardInstagramData)(userId);
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
async function recomputeGoalProgress(userId) {
    const rows = await db_1.gp.goal.findMany({
        where: { userId, status: "ATIVA" },
    });
    const completedNow = [];
    for (const row of rows) {
        const r = row;
        if (r.targetValue == null || r.targetValue <= 0)
            continue;
        const platform = r.platform ?? "instagram";
        const real = await realCurrentValue(userId, r.category, platform);
        const reached = real >= r.targetValue;
        if (reached) {
            await db_1.gp.goal.update({
                where: { id: r.id },
                data: { currentValue: r.targetValue, status: "CONCLUIDA" },
            });
            // Concede XP da meta concluída (idempotente por source+refId).
            await (0, xp_1.grantXpAmount)(userId, "concluir-meta", r.id, 35);
            completedNow.push(r.id);
        }
        else {
            await db_1.gp.goal.update({
                where: { id: r.id },
                data: { currentValue: real },
            });
        }
    }
    const goals = await listGoals(userId);
    return { goals, completedNow };
}
