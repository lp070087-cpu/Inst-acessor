import { pl } from "@/lib/planning/db";

/**
 * VERSÕES DE COPY — Fase 6
 * =========================
 * Versionamento SIMPLES de copy por conteúdo planejado:
 * - Nunca sobrescreve silenciosamente: toda edição vira uma nova versão.
 * - A versão 1 é criada automaticamente ao anexar uma copy (copyId).
 * - O usuário pode adicionar novas versões (rascunhos alternativos).
 */

export interface ContentCopyVersionView {
  id: string;
  contentId: string;
  version: number;
  content: string;
  note: string | null;
  createdAt: string;
}

interface CopyVersionRow {
  id: string;
  userId: string;
  contentId: string;
  version: number;
  content: string;
  note: string | null;
  createdAt: Date;
}

function toView(row: CopyVersionRow): ContentCopyVersionView {
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
export async function listCopyVersions(userId: string, contentId: string): Promise<ContentCopyVersionView[]> {
  // Ownership check: o conteúdo precisa pertencer ao usuário.
  const content = (await pl.content.findUnique({ where: { id: contentId } })) as unknown as
    | { userId: string }
    | null;
  if (!content || content.userId !== userId) return [];

  const rows = (await pl.copyVersion.findMany({
    where: { contentId },
    orderBy: { version: "asc" },
  })) as unknown as CopyVersionRow[];
  return rows.map(toView);
}

/** Adiciona uma nova versão de copy (auto-incrementa o número). */
export async function addCopyVersion(
  userId: string,
  contentId: string,
  data: { content: string; note?: string }
): Promise<ContentCopyVersionView | null> {
  const content = (await pl.content.findUnique({ where: { id: contentId } })) as unknown as
    | { userId: string }
    | null;
  if (!content || content.userId !== userId) return null;

  const last = (await pl.copyVersion.findFirst({
    where: { contentId },
    orderBy: { version: "desc" },
  })) as unknown as CopyVersionRow | null;

  const nextVersion = last ? last.version + 1 : 1;

  const created = (await pl.copyVersion.create({
    data: {
      userId,
      contentId,
      version: nextVersion,
      content: data.content,
      note: data.note || null,
    },
  })) as unknown as CopyVersionRow;

  return toView(created);
}

/** Reverte para uma versão anterior (cria uma nova versão com o texto antigo). */
export async function restoreCopyVersion(
  userId: string,
  contentId: string,
  version: number
): Promise<ContentCopyVersionView | null> {
  const content = (await pl.content.findUnique({ where: { id: contentId } })) as unknown as
    | { userId: string }
    | null;
  if (!content || content.userId !== userId) return null;

  const target = (await pl.copyVersion.findFirst({
    where: { contentId, version },
  })) as unknown as CopyVersionRow | null;
  if (!target) return null;

  // Nunca sobrescreve: cria uma versão nova com o texto da versão antiga.
  return addCopyVersion(userId, contentId, {
    content: target.content,
    note: `Restaurado da versão ${version}`,
  });
}
