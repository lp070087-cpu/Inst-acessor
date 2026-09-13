"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExperiment = createExperiment;
exports.listExperiments = listExperiments;
exports.getExperiment = getExperiment;
exports.updateExperimentStatus = updateExperimentStatus;
exports.addVariant = addVariant;
exports.addObservation = addObservation;
exports.deleteExperiment = deleteExperiment;
const repository_1 = require("./repository");
const types_1 = require("./types");
const VALID_STATUS = types_1.EXPERIMENT_STATUSES;
function isStatus(v) {
    return VALID_STATUS.includes(v);
}
async function createExperiment(userId, data) {
    const created = await repository_1.kb.experiment.create({
        data: {
            userId,
            platform: data.platform,
            hypothesis: data.hypothesis,
            variable: data.variable,
            baseline: data.baseline ?? null,
            status: "DRAFT",
        },
    });
    return toDto(created);
}
async function listExperiments(userId) {
    const rows = await repository_1.kb.experiment.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
    });
    const out = [];
    for (const row of rows) {
        const dto = await enrich(row);
        if (dto)
            out.push(dto);
    }
    return out;
}
async function getExperiment(userId, id) {
    const row = await repository_1.kb.experiment.findUnique({ where: { id } });
    if (!row)
        return null;
    if (row.userId !== userId)
        return null;
    return enrich(row);
}
async function updateExperimentStatus(userId, id, status) {
    if (!isStatus(status))
        return null;
    const existing = await repository_1.kb.experiment.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    const now = new Date();
    const data = { status };
    if (status === "RUNNING" && !existing.startedAt) {
        data.startedAt = now;
    }
    if (["CONFIRMED", "REJECTED", "INCONCLUSIVE", "ARCHIVED"].includes(status)) {
        data.endedAt = now;
    }
    const updated = await repository_1.kb.experiment.update({ where: { id }, data });
    return enrich(updated);
}
async function addVariant(userId, experimentId, data) {
    const exp = await repository_1.kb.experiment.findUnique({ where: { id: experimentId } });
    if (!exp || exp.userId !== userId)
        return null;
    const created = await repository_1.kb.variant.create({
        data: { experimentId, ...data },
    });
    return toVariant(created);
}
async function addObservation(userId, experimentId, data) {
    const exp = await repository_1.kb.experiment.findUnique({ where: { id: experimentId } });
    if (!exp || exp.userId !== userId)
        return null;
    const created = await repository_1.kb.observation.create({
        data: {
            experimentId,
            metric: data.metric,
            before: data.before ?? null,
            after: data.after ?? null,
            delta: data.delta ?? (data.before != null && data.after != null ? data.after - data.before : null),
            conclusion: data.conclusion ?? null,
            confidence: data.confidence ?? null,
        },
    });
    return toObservation(created);
}
async function deleteExperiment(userId, id) {
    const existing = await repository_1.kb.experiment.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await repository_1.kb.experiment.delete({ where: { id } });
    return true;
}
// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
async function enrich(row) {
    const [variants, observations] = await Promise.all([
        repository_1.kb.variant.findMany({ where: { experimentId: row.id } }),
        repository_1.kb.observation.findMany({ where: { experimentId: row.id } }),
    ]);
    return {
        ...row,
        variants: variants.map(toVariant),
        observations: observations.map(toObservation),
    };
}
function toVariant(v) {
    return {
        contentId: v.contentId ?? undefined,
        variation: v.variation ?? undefined,
        hookType: v.hookType ?? undefined,
        format: v.format ?? undefined,
        theme: v.theme ?? undefined,
        structure: v.structure ?? undefined,
    };
}
function toObservation(o) {
    return {
        metric: o.metric,
        before: o.before ?? undefined,
        after: o.after ?? undefined,
        delta: o.delta ?? undefined,
        conclusion: o.conclusion ?? undefined,
        confidence: o.confidence ?? undefined,
    };
}
function toDto(row) {
    return {
        id: row.id,
        platform: row.platform,
        hypothesis: row.hypothesis,
        variable: row.variable,
        baseline: row.baseline ?? null,
        status: isStatus(row.status) ? row.status : "DRAFT",
        startedAt: row.startedAt ?? null,
        endedAt: row.endedAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        variants: [],
        observations: [],
    };
}
