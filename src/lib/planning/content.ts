import { prisma } from "@/lib/db";
import { pl } from "@/lib/planning/db";
import { gp } from "@/lib/gamification/db";
import { kb } from "@/lib/knowledge/repository";

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

export const CONTENT_STATUSES = [
  "RASCUNHO",
  "IDEIA",
  "EM_PRODUCAO",
  "PRONTO",
  "AGENDADO",
  "PUBLICADO",
  "CANCELADO",
  "FALHOU",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface PlannedContentView {
  id: string;
  platform: string;
  format: string;
  title: string;
  theme: string | null;
  objective: string | null;
  status: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  notes: string | null;
  hypothesis: string | null;
  ideaId: string | null;
  copyId: string | null;
  draftId: string | null;
  goalId: string | null;
  /** ids de experimentos associados */
  experimentIds: string[];
  /** versões de copy existentes */
  copyVersionCount: number;
  ideaTitle: string | null;
  copyContent: string | null;
  draftCaption: string | null;
  goalTitle: string | null;
  experimentTitles: string[];
  createdAt: string;
}

function toView(
  row: {
    id: string;
    platform: string;
    format: string;
    title: string;
    theme: string | null;
    objective: string | null;
    status: string;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    externalId: string | null;
    notes: string | null;
    hypothesis: string | null;
    ideaId: string | null;
    copyId: string | null;
    draftId: string | null;
    goalId: string | null;
    createdAt: Date;
  },
  extra: {
    experimentIds: string[];
    copyVersionCount: number;
    ideaTitle?: string | null;
    copyContent?: string | null;
    draftCaption?: string | null;
    goalTitle?: string | null;
    experimentTitles: string[];
  }
): PlannedContentView {
  return {
    id: row.id,
    platform: row.platform,
    format: row.format,
    title: row.title,
    theme: row.theme,
    objective: row.objective,
    status: row.status as ContentStatus,
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

async function loadExtras(
  userId: string,
  row: { id: string; ideaId: string | null; copyId: string | null; draftId: string | null; goalId: string | null }
) {
  const [experiments, copyVersions, idea, copy, draft, goal] = await Promise.all([
    pl.contentExperiment.findMany({ where: { contentId: row.id } }),
    pl.copyVersion.count({ where: { contentId: row.id } }),
    row.ideaId ? prisma.contentIdea.findUnique({ where: { id: row.ideaId } }) : null,
    row.copyId ? prisma.generatedCopy.findUnique({ where: { id: row.copyId } }) : null,
    row.draftId ? prisma.socialDraft.findUnique({ where: { id: row.draftId } }) : null,
    row.goalId ? gp.goal.findUnique({ where: { id: row.goalId } }) : null,
  ]);

  const experimentIds: string[] = [];
  const experimentTitles: string[] = [];
  for (const e of experiments as { experimentId: string }[]) {
    experimentIds.push(e.experimentId);
    const exp = await kb.experiment.findUnique({ where: { id: e.experimentId } });
    if (exp) experimentTitles.push((exp as { hypothesis: string }).hypothesis);
  }

  return {
    experimentIds,
    experimentTitles,
    copyVersionCount: copyVersions,
    ideaTitle: idea ? ((idea as { title: string }).title ?? null) : null,
    copyContent: copy ? ((copy as { content: string }).content ?? null) : null,
    draftCaption: draft ? ((draft as { caption?: string | null }).caption ?? null) : null,
    goalTitle: goal ? ((goal as { title: string }).title ?? null) : null,
  };
}

export async function listPlannedContent(userId: string, filters?: {
  platform?: string;
  format?: string;
  status?: string;
  objective?: string;
  experimentId?: string;
  goalId?: string;
  from?: string;
  to?: string;
}): Promise<PlannedContentView[]> {
  const where: Record<string, unknown> = { userId };

  if (filters?.platform) where.platform = filters.platform;
  if (filters?.format) where.format = filters.format;
  if (filters?.status) where.status = filters.status;
  if (filters?.objective) where.objective = { contains: filters.objective } as unknown;
  if (filters?.goalId) where.goalId = filters.goalId;
  if (filters?.from || filters?.to) {
    where.scheduledAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    } as unknown;
  }

  const rows = (await pl.content.findMany({
    where,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 500,
  })) as unknown as Parameters<typeof toView>[0][];

  if (filters?.experimentId) {
    // Filtro por experimento associado: filtra após buscar os relacionamentos
    const filtered: PlannedContentView[] = [];
    for (const row of rows) {
      const extras = await loadExtras(userId, row);
      if (!extras.experimentIds.includes(filters.experimentId)) continue;
      filtered.push(toView(row, extras));
    }
    return filtered;
  }

  const out: PlannedContentView[] = [];
  for (const row of rows) {
    const extras = await loadExtras(userId, row);
    out.push(toView(row, extras));
  }
  return out;
}

export async function getPlannedContent(userId: string, id: string): Promise<PlannedContentView | null> {
  const row = (await pl.content.findUnique({ where: { id } })) as unknown as
    | (Parameters<typeof toView>[0] & { userId: string })
    | null;
  if (!row || row.userId !== userId) return null;
  const extras = await loadExtras(userId, row);
  return toView(row, extras);
}

export async function createPlannedContent(
  userId: string,
  data: {
    platform: string;
    format: string;
    title: string;
    theme?: string;
    objective?: string;
    scheduledAt?: string | null;
    notes?: string;
    hypothesis?: string;
    ideaId?: string | null;
    copyId?: string | null;
    draftId?: string | null;
    goalId?: string | null;
  }
): Promise<PlannedContentView> {
  const created = (await pl.content.create({
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
  })) as unknown as Parameters<typeof toView>[0];

  // Ao associar uma ideia, marca a ideia como PRODUZIDA (vínculo real).
  if (data.ideaId) {
    await prisma.contentIdea.updateMany({
      where: { id: data.ideaId, userId },
      data: { status: "PRODUZIDA" },
    });
  }

  // Ao associar uma copy, cria a versão 1 automaticamente (nunca sobrescreve).
  if (data.copyId) {
    const copy = (await prisma.generatedCopy.findUnique({
      where: { id: data.copyId },
    })) as unknown as { userId: string; content: string } | null;
    if (copy && copy.userId === userId && copy.content) {
      await pl.copyVersion.create({
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

export async function updatePlannedContent(
  userId: string,
  id: string,
  data: {
    platform?: string;
    format?: string;
    title?: string;
    theme?: string | null;
    objective?: string | null;
    status?: string;
    scheduledAt?: string | null;
    notes?: string | null;
    hypothesis?: string | null;
    ideaId?: string | null;
    copyId?: string | null;
    draftId?: string | null;
    goalId?: string | null;
  }
): Promise<PlannedContentView | null> {
  const existing = (await pl.content.findUnique({ where: { id } })) as unknown as {
    userId: string;
    copyId: string | null;
  } | null;
  if (!existing || existing.userId !== userId) return null;

  const updated = (await pl.content.update({
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
  })) as unknown as Parameters<typeof toView>[0];

  // Ao vincular uma copy em um update, garante a versão 1 (se ainda não existe).
  if (data.copyId && data.copyId !== existing?.copyId) {
    const copy = (await prisma.generatedCopy.findUnique({
      where: { id: data.copyId },
    })) as unknown as { userId: string; content: string } | null;
    if (copy && copy.userId === userId && copy.content) {
      const existingVersion = await pl.copyVersion.findFirst({
        where: { contentId: id, version: 1 },
      });
      if (!existingVersion) {
        await pl.copyVersion.create({
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

export async function deletePlannedContent(userId: string, id: string): Promise<boolean> {
  const existing = (await pl.content.findUnique({ where: { id } })) as unknown as {
    userId: string;
  } | null;
  if (!existing || existing.userId !== userId) return false;
  await pl.content.delete({ where: { id } });
  return true;
}

export async function duplicatePlannedContent(
  userId: string,
  id: string
): Promise<PlannedContentView | null> {
  const existing = (await pl.content.findUnique({ where: { id } })) as unknown as {
    userId: string;
    platform: string;
    format: string;
    title: string;
    theme: string | null;
    objective: string | null;
    notes: string | null;
    hypothesis: string | null;
    ideaId: string | null;
    copyId: string | null;
    draftId: string | null;
    goalId: string | null;
  } | null;
  if (!existing || existing.userId !== userId) return null;

  const created = (await pl.content.create({
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
  })) as unknown as Parameters<typeof toView>[0];

  const extras = await loadExtras(userId, created);
  return toView(created, extras);
}
