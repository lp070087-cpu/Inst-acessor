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
  /** Mídia pública do rascunho vinculado — alimenta a miniatura no calendário. */
  draftMediaUrl: string | null;
  draftMediaType: string | null;
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
    draftMediaUrl?: string | null;
    draftMediaType?: string | null;
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
    draftMediaUrl: extra.draftMediaUrl ?? null,
    draftMediaType: extra.draftMediaType ?? null,
    goalTitle: extra.goalTitle ?? null,
    experimentTitles: extra.experimentTitles,
    createdAt: row.createdAt.toISOString(),
  };
}

interface Extras {
  experimentIds: string[];
  experimentTitles: string[];
  copyVersionCount: number;
  ideaTitle: string | null;
  copyContent: string | null;
  draftCaption: string | null;
  draftMediaUrl: string | null;
  draftMediaType: string | null;
  goalTitle: string | null;
}

/** Uma linha de conteúdo, já reduzida ao que `loadExtras` precisa. */
interface ContentRowLite {
  id: string;
  ideaId: string | null;
  copyId: string | null;
  draftId: string | null;
  goalId: string | null;
}

/**
 * CARREGA OS RELACIONAMENTOS DE **VÁRIAS** LINHAS EM LOTE (correção de N+1).
 *
 * O problema (medido no código, não suposto): a versão anterior resolvia os
 * relacionamentos de UMA linha por chamada — 6 consultas, e ainda DENTRO delas
 * um laço que fazia um `findUnique` por experimento vinculado. Aplicada em laço
 * sobre a lista do calendário (`take: 500`), isso chegava à ordem de MILHARES
 * de idas ao banco numa única abertura de página, todas SEQUENCIAIS. É o maior
 * gargalo de navegação do app.
 *
 * A correção NÃO muda a saída: aqui fazemos 6 consultas no TOTAL (com `in`),
 * para qualquer quantidade de linhas, e um único `findMany` para os títulos
 * dos experimentos. Os resultados são então agrupados em memória por id —
 * trabalho O(n) local, sem tráfego de banco por item. A ordem dos ids dentro
 * de um conteúdo é preservada (a lista vem ordenada por `createdAt asc`, a
 * MESMA ordenação de antes).
 */
async function loadExtrasBatch(rows: ContentRowLite[]): Promise<Map<string, Extras>> {
  const byId = new Map<string, Extras>();
  if (rows.length === 0) return byId;

  const contentIds = rows.map((r) => r.id);
  const ideaIds = [...new Set(rows.map((r) => r.ideaId).filter((v): v is string => Boolean(v)))];
  const copyIds = [...new Set(rows.map((r) => r.copyId).filter((v): v is string => Boolean(v)))];
  const draftIds = [...new Set(rows.map((r) => r.draftId).filter((v): v is string => Boolean(v)))];
  const goalIds = [...new Set(rows.map((r) => r.goalId).filter((v): v is string => Boolean(v)))];

  const [links, versions, ideas, copies, drafts, goals] = await Promise.all([
    pl.contentExperiment.findMany({
      where: { contentId: { in: contentIds } },
      orderBy: { createdAt: "asc" },
    }),
    pl.copyVersion.findMany({ where: { contentId: { in: contentIds } }, select: { contentId: true } }),
    ideaIds.length
      ? prisma.contentIdea.findMany({ where: { id: { in: ideaIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    copyIds.length
      ? prisma.generatedCopy.findMany({ where: { id: { in: copyIds } }, select: { id: true, content: true } })
      : Promise.resolve([]),
    draftIds.length
      ? prisma.socialDraft.findMany({
          where: { id: { in: draftIds } },
          select: { id: true, caption: true, mediaUrl: true, mediaType: true },
        })
      : Promise.resolve([]),
    goalIds.length
      ? gp.goal.findMany({ where: { id: { in: goalIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);

  // Títulos dos experimentos — UMA consulta para todos os vínculos de todas as
  // linhas (antes era um findUnique por vínculo).
  const experimentIds = [...new Set((links as { experimentId: string }[]).map((l) => l.experimentId))];
  const experimentRows = experimentIds.length
    ? ((await kb.experiment.findMany({
        where: { id: { in: experimentIds } },
        select: { id: true, hypothesis: true },
      })) as unknown as { id: string; hypothesis: string | null }[])
    : [];
  const hypothesisById = new Map(experimentRows.map((e) => [e.id, e.hypothesis]));

  // Contagem de versões de copy por conteúdo (em memória — este delegate não
  // expõe `groupBy`, e a quantidade por conteúdo é pequena).
  const versionsByContent = new Map<string, number>();
  for (const v of versions as unknown as { contentId: string }[]) {
    versionsByContent.set(v.contentId, (versionsByContent.get(v.contentId) ?? 0) + 1);
  }

  const ideaById = new Map((ideas as unknown as { id: string; title: string | null }[]).map((x) => [x.id, x.title]));
  const copyById = new Map((copies as unknown as { id: string; content: string | null }[]).map((x) => [x.id, x.content]));
  const draftById = new Map(
    (drafts as unknown as {
      id: string;
      caption: string | null;
      mediaUrl: string | null;
      mediaType: string | null;
    }[]).map((x) => [x.id, x]),
  );
  const goalById = new Map((goals as unknown as { id: string; title: string | null }[]).map((x) => [x.id, x.title]));

  const linksByContent = new Map<string, { experimentId: string }[]>();
  for (const l of links as unknown as { contentId: string; experimentId: string }[]) {
    const arr = linksByContent.get(l.contentId) ?? [];
    arr.push({ experimentId: l.experimentId });
    linksByContent.set(l.contentId, arr);
  }

  for (const row of rows) {
    const cLinks = linksByContent.get(row.id) ?? [];
    const exIds = cLinks.map((l) => l.experimentId);
    const exTitles = exIds
      .map((id) => hypothesisById.get(id))
      .filter((t): t is string => typeof t === "string");

    const draft = row.draftId ? draftById.get(row.draftId) : undefined;
    byId.set(row.id, {
      experimentIds: exIds,
      experimentTitles: exTitles,
      copyVersionCount: versionsByContent.get(row.id) ?? 0,
      ideaTitle: row.ideaId ? (ideaById.get(row.ideaId) ?? null) : null,
      copyContent: row.copyId ? (copyById.get(row.copyId) ?? null) : null,
      draftCaption: draft ? (draft.caption ?? null) : null,
      draftMediaUrl: draft ? (draft.mediaUrl ?? null) : null,
      draftMediaType: draft ? (draft.mediaType ?? null) : null,
      goalTitle: row.goalId ? (goalById.get(row.goalId) ?? null) : null,
    });
  }

  return byId;
}

/** Versão de UMA linha, usada pelos endpoints que buscam por id. */
async function loadExtras(userId: string, row: ContentRowLite): Promise<Extras> {
  void userId;
  const batch = await loadExtrasBatch([row]);
  return (
    batch.get(row.id) ?? {
      experimentIds: [],
      experimentTitles: [],
      copyVersionCount: 0,
      ideaTitle: null,
      copyContent: null,
      draftCaption: null,
      draftMediaUrl: null,
      draftMediaType: null,
      goalTitle: null,
    }
  );
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

  // UMA leva de consultas para TODAS as linhas (antes: 6+ consultas por linha,
  // em série até para 500 linhas — ver `loadExtrasBatch`).
  const extrasById = await loadExtrasBatch(rows as unknown as ContentRowLite[]);

  if (filters?.experimentId) {
    // Filtro por experimento associado: filtra após buscar os relacionamentos
    const filtered: PlannedContentView[] = [];
    for (const row of rows) {
      const extras = extrasById.get(row.id);
      if (!extras || !extras.experimentIds.includes(filters.experimentId)) continue;
      filtered.push(toView(row, extras));
    }
    return filtered;
  }

  const out: PlannedContentView[] = [];
  for (const row of rows) {
    const extras = extrasById.get(row.id);
    if (!extras) continue;
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
