import { ai } from "@/lib/ai/db";

/**
 * Serviço de rascunhos do Preview Social.
 * Apenas persistência local dos dados do usuário — sem publicação,
 * sem chamadas a Meta/TikTok.
 */

export interface DraftData {
  platform: string;
  mediaType?: string;
  mediaUrl?: string;
  caption?: string;
  hashtags?: string;
  format?: string;
  /** Itens do carrossel (até 7) — persistidos como Json no SocialDraft. */
  items?: unknown;
}

/** Lista rascunhos do usuário. */
export async function listDrafts(userId: string) {
  const rows = await ai.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows as {
    id: string;
    platform: string;
    mediaType: string;
    mediaUrl?: string | null;
    caption?: string | null;
    hashtags?: string | null;
    format?: string | null;
    items?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

export async function saveDraft(userId: string, data: DraftData) {
  const created = await ai.draft.create({
    data: { userId, ...data },
  });
  return created;
}

/** Atualiza um rascunho existente (ownership-checked). */
export async function updateDraft(userId: string, id: string, data: DraftData) {
  const existing = await ai.draft.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return null;
  return ai.draft.update({ where: { id }, data });
}

/** Exclui um rascunho (ownership-checked). */
export async function deleteDraft(userId: string, id: string) {
  const existing = await ai.draft.findUnique({ where: { id } });
  if (!existing || (existing as { userId: string }).userId !== userId) return false;
  await ai.draft.delete({ where: { id } });
  return true;
}
