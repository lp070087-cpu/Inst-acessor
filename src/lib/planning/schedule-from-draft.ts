import { pl } from "@/lib/planning/db";
import { prisma } from "@/lib/db";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

/**
 * AGENDAR A PARTIR DO PREVIEW SOCIAL — Fase 6.5 (6.5.11/6.5.12/6.5.13)
 * =====================================================================
 * Ponte entre o Preview Social e o Calendário (PlannedContent).
 *
 * - 6.5.11: escolher data/hora → PROGRAMAR → cria/atualiza PlannedContent.
 * - 6.5.12: vários dias → cria N conteúdos planejados (um por dia),
 *   SEM recorrência infinita, SEM duplicação silenciosa (confirma antes).
 * - 6.5.13: editar conteúdo programado a partir do calendário.
 *
 * Tudo é agendamento INTERNO — nada é enviado a Meta/TikTok.
 * Owner-check: o `userId` da sessão é a fonte de verdade.
 */

export interface ScheduleFromDraftInput {
  userId: string;
  draftId: string;
  platform: string;
  format: string;
  /** Título interno do conteúdo (derivado ou fornecido). */
  title: string;
  /** Objetivo (opcional). */
  objective?: string;
  /** Datas/horários ISO. Vários = cria vários PlannedContent. */
  scheduledAtList: string[];
  /** Associações opcionais herdadas do contexto. */
  ideaId?: string | null;
  copyId?: string | null;
  goalId?: string | null;
}

export interface ScheduleFromDraftResult {
  ok: boolean;
  created: number;
  contents: { id: string; scheduledAt: string | null }[];
  error?: string;
}

/**
 * Agenda um (ou vários) conteúdos a partir de um rascunho do Preview Social.
 * Valida ownership do draft; cria um PlannedContent por data.
 */
export async function scheduleFromDraft(
  input: ScheduleFromDraftInput
): Promise<ScheduleFromDraftResult> {
  const { userId, draftId, platform, format, title, scheduledAtList } = input;

  // Owner-check do rascunho.
  const draft = (await prisma.socialDraft.findUnique({
    where: { id: draftId },
  })) as unknown as { userId: string } | null;
  if (!draft || draft.userId !== userId) {
    return { ok: false, created: 0, contents: [], error: "Rascunho não encontrado" };
  }

  if (!scheduledAtList.length) {
    return { ok: false, created: 0, contents: [], error: "Nenhuma data informada" };
  }

  const contents: { id: string; scheduledAt: string | null }[] = [];
  for (const scheduledAt of scheduledAtList) {
    const created = (await pl.content.create({
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
    })) as unknown as { id: string; scheduledAt: Date | null };
    contents.push({
      id: created.id,
      scheduledAt: created.scheduledAt ? created.scheduledAt.toISOString() : null,
    });
  }

  // XP real (idempotente): uma única concessão por agendamento em lote.
  if (contents.length > 0) {
    await grantXp(userId, "planejar-conteudo", `draft-${draftId}`);
    await checkAndUnlockAchievements(userId);
  }

  return { ok: true, created: contents.length, contents };
}

/**
 * Remove o vínculo de um conteúdo planejado com um rascunho (owner-check).
 * Útil quando o usuário troca a mídia base do conteúdo no calendário.
 */
export async function detachDraftFromContent(
  userId: string,
  contentId: string
): Promise<boolean> {
  const existing = (await pl.content.findUnique({
    where: { id: contentId },
  })) as unknown as { userId: string } | null;
  if (!existing || existing.userId !== userId) return false;
  await pl.content.update({
    where: { id: contentId },
    data: { draftId: null },
  });
  return true;
}
