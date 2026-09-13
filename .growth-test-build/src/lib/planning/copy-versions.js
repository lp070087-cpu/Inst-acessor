"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCopyVersions = listCopyVersions;
exports.addCopyVersion = addCopyVersion;
exports.restoreCopyVersion = restoreCopyVersion;
const db_1 = require("@/lib/planning/db");
function toView(row) {
    return {
        id: row.id,
        contentId: row.contentId,
        version: row.version,
        content: row.content,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
    };
}
/** Lista as versões de copy de um conteúdo (dono validado). */
async function listCopyVersions(userId, contentId) {
    // Ownership check: o conteúdo precisa pertencer ao usuário.
    const content = (await db_1.pl.content.findUnique({ where: { id: contentId } }));
    if (!content || content.userId !== userId)
        return [];
    const rows = (await db_1.pl.copyVersion.findMany({
        where: { contentId },
        orderBy: { version: "asc" },
    }));
    return rows.map(toView);
}
/** Adiciona uma nova versão de copy (auto-incrementa o número). */
async function addCopyVersion(userId, contentId, data) {
    const content = (await db_1.pl.content.findUnique({ where: { id: contentId } }));
    if (!content || content.userId !== userId)
        return null;
    const last = (await db_1.pl.copyVersion.findFirst({
        where: { contentId },
        orderBy: { version: "desc" },
    }));
    const nextVersion = last ? last.version + 1 : 1;
    const created = (await db_1.pl.copyVersion.create({
        data: {
            userId,
            contentId,
            version: nextVersion,
            content: data.content,
            note: data.note || null,
        },
    }));
    return toView(created);
}
/** Reverte para uma versão anterior (cria uma nova versão com o texto antigo). */
async function restoreCopyVersion(userId, contentId, version) {
    const content = (await db_1.pl.content.findUnique({ where: { id: contentId } }));
    if (!content || content.userId !== userId)
        return null;
    const target = (await db_1.pl.copyVersion.findFirst({
        where: { contentId, version },
    }));
    if (!target)
        return null;
    // Nunca sobrescreve: cria uma versão nova com o texto da versão antiga.
    return addCopyVersion(userId, contentId, {
        content: target.content,
        note: `Restaurado da versão ${version}`,
    });
}
