"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundError = void 0;
exports.listActions = listActions;
exports.getAction = getAction;
exports.createAction = createAction;
exports.updateActionStatus = updateActionStatus;
exports.deleteAction = deleteAction;
exports.completeActionWithXp = completeActionWithXp;
exports.expireOverdueActions = expireOverdueActions;
exports.syncRecommendationsToActions = syncRecommendationsToActions;
const db_1 = require("./db");
const errors_1 = require("./errors");
Object.defineProperty(exports, "notFoundError", { enumerable: true, get: function () { return errors_1.notFoundError; } });
const xp_1 = require("@/lib/gamification/xp");
/**
 * AÇÕES DE CRESCIMENTO (GrowthAction) — Fase 8 (Parte 7 + Parte 17)
 * ==================================================================
 * Plano de ação operacional. Persistido em `GrowthAction`.
 *
 * Regras:
 * - owner-check: `userId` da sessão é a fonte de verdade.
 * - Deduplicação: não criar ação repetida para o mesmo `sourceRecommendation`
 *   (quando existir) — evita spam de ações idênticas.
 * - XP (Parte 17): concedido SOMENTE quando a ação é concluída de verdade
 *   (status COMPLETED) e UMA ÚNICA vez (idempotente por source+refId).
 * - Não duplica UserGoal nem PlannedContent: ação é recomendação executável.
 */
function toView(row) {
    return {
        id: row.id,
        platform: row.platform ?? "instagram",
        title: row.title,
        description: row.description ?? null,
        reason: row.reason ?? null,
        priority: row.priority ?? 2,
        status: row.status ?? "PENDING",
        dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        dismissedAt: row.dismissedAt ? new Date(row.dismissedAt).toISOString() : null,
        sourceSignal: row.sourceSignal ?? null,
        sourceRecommendation: row.sourceRecommendation ?? null,
        metricToWatch: row.metricToWatch ?? null,
        baselineValue: row.baselineValue ?? null,
        resultValue: row.resultValue ?? null,
        resultNote: row.resultNote ?? null,
        xpGranted: Boolean(row.xpGranted),
        createdAt: new Date(row.createdAt).toISOString(),
    };
}
/** Lista ações do usuário (mais recentes primeiro). */
async function listActions(userId, status) {
    const rows = await db_1.ge.action.findMany({
        where: { userId, ...(status ? { status } : {}) },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
    });
    return rows.map(toView);
}
/** Busca uma ação (owner-check). */
async function getAction(userId, id) {
    const row = await db_1.ge.action.findUnique({ where: { id } });
    if (!row)
        return null;
    if (row.userId !== userId)
        return null;
    return toView(row);
}
/** Cria uma ação (com deduplicação por sourceRecommendation, quando houver). */
async function createAction(userId, input) {
    // Deduplicação: mesma recomendação não vira duas ações pendentes.
    if (input.sourceRecommendation) {
        const existing = await db_1.ge.action.findFirst({
            where: {
                userId,
                sourceRecommendation: input.sourceRecommendation,
                status: { in: ["PENDING", "IN_PROGRESS"] },
            },
        });
        if (existing) {
            throw (0, errors_1.validationError)("Já existe uma ação pendente para esta recomendação.");
        }
    }
    const created = await db_1.ge.action.create({
        data: {
            userId,
            platform: input.platform,
            title: input.title,
            description: input.description ?? null,
            reason: input.reason ?? null,
            priority: input.priority,
            status: "PENDING",
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            sourceSignal: input.sourceSignal ?? null,
            sourceRecommendation: input.sourceRecommendation ?? null,
            metricToWatch: input.metricToWatch ?? null,
            baselineValue: input.baselineValue ?? null,
            xpGranted: false,
        },
    });
    return toView(created);
}
/** Atualiza o status de uma ação (com owner-check). */
async function updateActionStatus(userId, id, status, extra) {
    const row = await db_1.ge.action.findUnique({ where: { id } });
    if (!row)
        return null;
    if (row.userId !== userId)
        return null;
    const now = new Date();
    const data = { status };
    if (status === "COMPLETED") {
        data.completedAt = now;
        if (extra?.resultValue != null)
            data.resultValue = extra.resultValue;
        if (extra?.resultNote)
            data.resultNote = extra.resultNote;
    }
    else if (status === "DISMISSED") {
        data.dismissedAt = now;
    }
    const updated = await db_1.ge.action.update({
        where: { id },
        data,
    });
    return toView(updated);
}
/** Exclui uma ação (owner-check). */
async function deleteAction(userId, id) {
    const row = await db_1.ge.action.findUnique({ where: { id } });
    if (!row)
        return false;
    if (row.userId !== userId)
        return false;
    await db_1.ge.action.delete({ where: { id } });
    return true;
}
/**
 * Conclui uma ação e concede XP (Parte 17) — idempotente.
 * XP apenas quando a ação foi de fato concluída e nunca foi premiada.
 */
async function completeActionWithXp(userId, id, extra) {
    const row = await db_1.ge.action.findUnique({ where: { id } });
    if (!row)
        return { action: null, xp: { granted: false, amount: 0, alreadyGranted: false } };
    const record = row;
    if (record.userId !== userId)
        return { action: null, xp: { granted: false, amount: 0, alreadyGranted: false } };
    const alreadyCompleted = record.status === "COMPLETED";
    const updated = await db_1.ge.action.update({
        where: { id },
        data: {
            status: "COMPLETED",
            completedAt: new Date(),
            ...(extra?.resultValue != null ? { resultValue: extra.resultValue } : {}),
            ...(extra?.resultNote ? { resultNote: extra.resultNote } : {}),
        },
    });
    const view = toView(updated);
    // Concede XP apenas se ainda não concedeu (idempotente por source+refId).
    const xpResult = await (0, xp_1.grantXpAmount)(userId, "concluir-acao-crescimento", id, 15);
    // Marca xpGranted apenas se concedeu de verdade agora (evita loop de chamadas).
    if (xpResult.granted && !alreadyCompleted) {
        await db_1.ge.action.update({
            where: { id },
            data: { xpGranted: true },
        });
        view.xpGranted = true;
    }
    return { action: view, xp: { granted: xpResult.granted, amount: xpResult.amount, alreadyGranted: xpResult.alreadyGranted } };
}
/** Expira ações pendentes com dueAt no passado (uso interno/jobs). */
async function expireOverdueActions(userId) {
    const res = await db_1.ge.action.updateMany({
        where: {
            userId,
            status: "PENDING",
            dueAt: { lt: new Date() },
        },
        data: { status: "EXPIRED" },
    });
    return res.count;
}
/**
 * Sincroniza as recomendações atuais como ações (Parte 7): cria ações
 * PENDING para recomendações que ainda não viraram ação. Nunca duplica.
 */
async function syncRecommendationsToActions(ctx, recommendations) {
    const created = [];
    for (const rec of recommendations) {
        const existing = await db_1.ge.action.findFirst({
            where: {
                userId: ctx.userId,
                sourceRecommendation: rec.slug,
                status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
            },
        });
        if (existing)
            continue;
        try {
            const action = await createAction(ctx.userId, {
                platform: rec.platform ?? "instagram",
                title: rec.oQue,
                description: `${rec.porQue} — Evidência: ${rec.evidencia}. Como: ${rec.como}.`,
                reason: rec.porQue,
                priority: rec.priorityLevel,
                sourceSignal: rec.signalType,
                sourceRecommendation: rec.slug,
                metricToWatch: rec.metrica,
            });
            created.push(action);
        }
        catch {
            // dedup por corrida — ignora
        }
    }
    return created;
}
