"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDrafts = listDrafts;
exports.saveDraft = saveDraft;
exports.updateDraft = updateDraft;
exports.deleteDraft = deleteDraft;
const db_1 = require("@/lib/ai/db");
/** Lista rascunhos do usuário. */
async function listDrafts(userId) {
    const rows = await db_1.ai.draft.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
    });
    return rows;
}
async function saveDraft(userId, data) {
    const created = await db_1.ai.draft.create({
        data: { userId, ...data },
    });
    return created;
}
/** Atualiza um rascunho existente (ownership-checked). */
async function updateDraft(userId, id, data) {
    const existing = await db_1.ai.draft.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return null;
    return db_1.ai.draft.update({ where: { id }, data });
}
/** Exclui um rascunho (ownership-checked). */
async function deleteDraft(userId, id) {
    const existing = await db_1.ai.draft.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId)
        return false;
    await db_1.ai.draft.delete({ where: { id } });
    return true;
}
