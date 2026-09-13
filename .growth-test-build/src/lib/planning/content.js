"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_STATUSES = void 0;
exports.listPlannedContent = listPlannedContent;
exports.getPlannedContent = getPlannedContent;
exports.createPlannedContent = createPlannedContent;
exports.updatePlannedContent = updatePlannedContent;
exports.deletePlannedContent = deletePlannedContent;
exports.duplicatePlannedContent = duplicatePlannedContent;
const db_1 = require("@/lib/db");
const db_2 = require("@/lib/planning/db");
const db_3 = require("@/lib/gamification/db");
const repository_1 = require("@/lib/knowledge/repository");
/**
 * MOTOR DE CONTEÚDO PLANEJADO — Fase 6
 * ======================================
 * Pipeline de conteúdo no calendário. Todos os CRUD são ownership-checked
 * (o `userId` da sessão é a fonte de verdade — nunca vindo do client).
 *
 * Regras (ESCOPO-OFICIAL + Knowledge Engine Módulo 25):
 * - Estados: RASCUNHO | IDEIA | EM_PRODUCAO | PRONTO | AGENDADO | PUBLICADO | CANCELADO | FALHOU.
 * - "PUBLICADO" só com confirmação real futura do adapter (nunca marcado aqui).
 * - O conteúdo sabe se possui ideia/copy/preview/experimento/meta associados.
 */
exports.CONTENT_STATUSES = [
    "RASCUNHO",
    "IDEIA",
    "EM_PRODUCAO",
    "PRONTO",
    "AGENDADO",
    "PUBLICADO",
    "CANCELADO",
    "FALHOU",
];
function toView(row, extra) {
    return {
        id: row.id,
        platform: row.platform,
        format: row.format,
        title: row.title,
        theme: row.theme,
        objective: row.objective,
        status: row.status,
        scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        externalId: row.externalId,
        notes: row.notes,
        hypothesis: row.hypothesis,
        ideaId: row.ideaId,
        copyId: row.copyId,
        draftId: row.draftId,
        goalId: row.goalId,
        experimentIds: extra.experimentIds,
        copyVersionCount: extra.copyVersionCount,
        ideaTitle: extra.ideaTitle ?? null,
        copyContent: extra.copyContent ?? null,
        draftCaption: extra.draftCaption ?? null,
        goalTitle: extra.goalTitle ?? null,
        experimentTitles: extra.experimentTitles,
        createdAt: row.createdAt.toISOString(),
    };
}
async function loadExtras(userId, row) {
    const [experiments, copyVersions, idea, copy, draft, goal] = await Promise.all([
        db_2.pl.contentExperiment.findMany({ where: { contentId: row.id } }),
        db_2.pl.copyVersion.count({ where: { contentId: row.id } }),
        row.ideaId ? db_1.prisma.contentIdea.findUnique({ where: { id: row.ideaId } }) : null,
        row.copyId ? db_1.prisma.generatedCopy.findUnique({ where: { id: row.copyId } }) : null,
        row.draftId ? db_1.prisma.socialDraft.findUnique({ where: { id: row.draftId } }) : null,
        row.goalId ? db_3.gp.goal.findUnique({ where: { id: row.goalId } }) : null,
    ]);
    const experimentIds = [];
    const experimentTitles = [];
    for (const e of experiments) {
        experimentIds.push(e.experimentId);
        const exp = await repository_1.kb.experiment.findUnique({ where: { id: e.experimentId } });
        if (exp)
            experimentTitles.push(exp.hypothesis);
    }
    return {
        experimentIds,
        experimentTitles,
        copyVersionCount: copyVersions,
        ideaTitle: idea ? (idea.title ?? null) : null,
        copyContent: copy ? (copy.content ?? null) : null,
        draftCaption: draft ? (draft.caption ?? null) : null,
        goalTitle: goal ? (goal.title ?? null) : null,
    };
}
async function listPlannedContent(userId, filters) {
    const where = { userId };
    if (filters?.platform)
        where.platform = filters.platform;
    if (filters?.format)
        where.format = filters.format;
    if (filters?.status)
        where.status = filters.status;
    if (filters?.objective)
        where.objective = { contains: filters.objective };
    if (filters?.goalId)
        where.goalId = filters.goalId;
    if (filters?.from || filters?.to) {
        where.scheduledAt = {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
        };
    }
    const rows = (await db_2.pl.content.findMany({
        where,
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
        take: 500,
    }));
    if (filters?.experimentId) {
        // Filtro por experimento associado: filtra após buscar os relacionamentos
        const filtered = [];
        for (const row of rows) {
            const extras = await loadExtras(userId, row);
            if (!extras.experimentIds.includes(filters.experimentId))
                continue;
            filtered.push(toView(row, extras));
        }
        return filtered;
    }
    const out = [];
    for (const row of rows) {
        const extras = await loadExtras(userId, row);
        out.push(toView(row, extras));
    }
    return out;
}
async function getPlannedContent(userId, id) {
    const row = (await db_2.pl.content.findUnique({ where: { id } }));
    if (!row || row.userId !== userId)
        return null;
    const extras = await loadExtras(userId, row);
    return toView(row, extras);
}
async function createPlannedContent(userId, data) {
    const created = (await db_2.pl.content.create({
        data: {
            userId,
            platform: data.platform,
            format: data.format,
            title: data.title,
            theme: data.theme || null,
            objective: data.objective || null,
            status: data.scheduledAt ? "AGENDADO" : "RASCUNHO",
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            notes: data.notes || null,
            hypothesis: data.hypothesis || null,
            ideaId: data.ideaId ?? null,
            copyId: data.copyId ?? null,
            draftId: data.draftId ?? null,
            goalId: data.goalId ?? null,
        },
    }));
    // Ao associar uma ideia, marca a ideia como PRODUZIDA (vínculo real).
    if (data.ideaId) {
        await db_1.prisma.contentIdea.updateMany({
            where: { id: data.ideaId, userId },
            data: { status: "PRODUZIDA" },
        });
    }
    // Ao associar uma copy, cria a versão 1 automaticamente (nunca sobrescreve).
    if (data.copyId) {
        const copy = (await db_1.prisma.generatedCopy.findUnique({
            where: { id: data.copyId },
        }));
        if (copy && copy.userId === userId && copy.content) {
            await db_2.pl.copyVersion.create({
                data: {
                    userId,
                    contentId: created.id,
                    version: 1,
                    content: copy.content,
                    note: "Versão inicial (copy associada)",
                },
            });
        }
    }
    const extras = await loadExtras(userId, created);
    return toView(created, extras);
}
async function updatePlannedContent(userId, id, data) {
    const existing = (await db_2.pl.content.findUnique({ where: { id } }));
    if (!existing || existing.userId !== userId)
        return null;
    const updated = (await db_2.pl.content.update({
        where: { id },
        data: {
            ...(data.platform ? { platform: data.platform } : {}),
            ...(data.format ? { format: data.format } : {}),
            ...(data.title ? { title: data.title } : {}),
            ...(data.theme !== undefined ? { theme: data.theme ?? null } : {}),
            ...(data.objective !== undefined ? { objective: data.objective ?? null } : {}),
            ...(data.status ? { status: data.status } : {}),
            ...(data.scheduledAt !== undefined
                ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }
                : {}),
            ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
            ...(data.hypothesis !== undefined ? { hypothesis: data.hypothesis ?? null } : {}),
            ...(data.ideaId !== undefined ? { ideaId: data.ideaId ?? null } : {}),
            ...(data.copyId !== undefined ? { copyId: data.copyId ?? null } : {}),
            ...(data.draftId !== undefined ? { draftId: data.draftId ?? null } : {}),
            ...(data.goalId !== undefined ? { goalId: data.goalId ?? null } : {}),
        },
    }));
    // Ao vincular uma copy em um update, garante a versão 1 (se ainda não existe).
    if (data.copyId && data.copyId !== existing?.copyId) {
        const copy = (await db_1.prisma.generatedCopy.findUnique({
            where: { id: data.copyId },
        }));
        if (copy && copy.userId === userId && copy.content) {
            const existingVersion = await db_2.pl.copyVersion.findFirst({
                where: { contentId: id, version: 1 },
            });
            if (!existingVersion) {
                await db_2.pl.copyVersion.create({
                    data: {
                        userId,
                        contentId: id,
                        version: 1,
                        content: copy.content,
                        note: "Versão inicial (copy associada)",
                    },
                });
            }
        }
    }
    const extras = await loadExtras(userId, updated);
    return toView(updated, extras);
}
async function deletePlannedContent(userId, id) {
    const existing = (await db_2.pl.content.findUnique({ where: { id } }));
    if (!existing || existing.userId !== userId)
        return false;
    await db_2.pl.content.delete({ where: { id } });
    return true;
}
async function duplicatePlannedContent(userId, id) {
    const existing = (await db_2.pl.content.findUnique({ where: { id } }));
    if (!existing || existing.userId !== userId)
        return null;
    const created = (await db_2.pl.content.create({
        data: {
            userId,
            platform: existing.platform,
            format: existing.format,
            title: `${existing.title} (cópia)`,
            theme: existing.theme,
            objective: existing.objective,
            status: "RASCUNHO",
            scheduledAt: null,
            notes: existing.notes,
            hypothesis: existing.hypothesis,
            ideaId: existing.ideaId,
            copyId: existing.copyId,
            draftId: existing.draftId,
            goalId: existing.goalId,
        },
    }));
    const extras = await loadExtras(userId, created);
    return toView(created, extras);
}
