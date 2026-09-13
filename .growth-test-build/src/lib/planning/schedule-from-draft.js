"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleFromDraft = scheduleFromDraft;
exports.detachDraftFromContent = detachDraftFromContent;
const db_1 = require("@/lib/planning/db");
const db_2 = require("@/lib/db");
const gamification_1 = require("@/lib/gamification");
/**
 * Agenda um (ou vários) conteúdos a partir de um rascunho do Preview Social.
 * Valida ownership do draft; cria um PlannedContent por data.
 */
async function scheduleFromDraft(input) {
    const { userId, draftId, platform, format, title, scheduledAtList } = input;
    // Owner-check do rascunho.
    const draft = (await db_2.prisma.socialDraft.findUnique({
        where: { id: draftId },
    }));
    if (!draft || draft.userId !== userId) {
        return { ok: false, created: 0, contents: [], error: "Rascunho não encontrado" };
    }
    if (!scheduledAtList.length) {
        return { ok: false, created: 0, contents: [], error: "Nenhuma data informada" };
    }
    const contents = [];
    for (const scheduledAt of scheduledAtList) {
        const created = (await db_1.pl.content.create({
            data: {
                userId,
                platform,
                format,
                title,
                objective: input.objective || null,
                status: "AGENDADO",
                scheduledAt: new Date(scheduledAt),
                notes: "Agendado a partir do Preview Social.",
                hypothesis: null,
                ideaId: input.ideaId ?? null,
                copyId: input.copyId ?? null,
                draftId,
                goalId: input.goalId ?? null,
            },
        }));
        contents.push({
            id: created.id,
            scheduledAt: created.scheduledAt ? created.scheduledAt.toISOString() : null,
        });
    }
    // XP real (idempotente): uma única concessão por agendamento em lote.
    if (contents.length > 0) {
        await (0, gamification_1.grantXp)(userId, "planejar-conteudo", `draft-${draftId}`);
        await (0, gamification_1.checkAndUnlockAchievements)(userId);
    }
    return { ok: true, created: contents.length, contents };
}
/**
 * Remove o vínculo de um conteúdo planejado com um rascunho (owner-check).
 * Útil quando o usuário troca a mídia base do conteúdo no calendário.
 */
async function detachDraftFromContent(userId, contentId) {
    const existing = (await db_1.pl.content.findUnique({
        where: { id: contentId },
    }));
    if (!existing || existing.userId !== userId)
        return false;
    await db_1.pl.content.update({
        where: { id: contentId },
        data: { draftId: null },
    });
    return true;
}
