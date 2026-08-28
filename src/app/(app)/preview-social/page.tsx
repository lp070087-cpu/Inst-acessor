import type { Metadata } from "next";
import { Eye } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listDrafts, listCopies } from "@/lib/ai/services";
import { getPlannedContent } from "@/lib/planning";
import { prisma } from "@/lib/db";
import { PreviewSocial } from "@/components/ai/preview-social-client";

export const metadata: Metadata = {
  title: "Preview Social",
  description: "Visualize seus posts antes de publicar — preview local, sem envio a redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function PreviewSocialPage({
  searchParams,
}: {
  searchParams?: { content?: string };
}) {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const [drafts, copies] = await Promise.all([listDrafts(userId), listCopies(userId)]);

  // 6.5.13 — edição de conteúdo já programado vindo do Calendário (?content=id).
  let initialContent: {
    id: string;
    title: string;
    platform: string;
    format: string;
    scheduledAt?: string | null;
    draftId?: string | null;
    draft?: {
      id: string;
      platform: string;
      mediaType: string;
      mediaUrl: string;
      caption: string;
      hashtags: string;
      format: string;
      items?: unknown;
      updatedAt: string;
    } | null;
    ideaId?: string | null;
    copyId?: string | null;
    goalId?: string | null;
  } | null = null;

  const contentId = searchParams?.content;
  if (contentId) {
    const content = await getPlannedContent(userId, contentId);
    if (content) {
      // O rascunho vinculado pode estar além dos 50 primeiros da listagem —
      // busca direto no banco (owner-check: row.userId === userId).
      let draft: {
        id: string;
        platform: string;
        mediaType: string;
        mediaUrl: string;
        caption: string;
        hashtags: string;
        format: string;
        items?: unknown;
        updatedAt: string;
      } | null = null;

      const found = content.draftId ? drafts.find((d) => d.id === content.draftId) : null;
      if (found) {
        draft = {
          id: found.id,
          platform: found.platform,
          mediaType: found.mediaType,
          mediaUrl: found.mediaUrl ?? "",
          caption: found.caption ?? "",
          hashtags: found.hashtags ?? "",
          format: found.format ?? "",
          items: (found.items as unknown[]) ?? [],
          updatedAt: found.updatedAt.toISOString(),
        };
      } else if (content.draftId) {
        const row = (await prisma.socialDraft.findUnique({
          where: { id: content.draftId },
        })) as unknown as {
          id: string;
          userId: string;
          platform: string;
          mediaType: string;
          mediaUrl: string | null;
          caption: string | null;
          hashtags: string | null;
          format: string | null;
          items?: unknown;
          updatedAt: Date;
        } | null;
        // Owner-check: só carrega se o rascunho pertence ao usuário da sessão.
        if (row && row.userId === userId) {
          draft = {
            id: row.id,
            platform: row.platform,
            mediaType: row.mediaType,
            mediaUrl: row.mediaUrl ?? "",
            caption: row.caption ?? "",
            hashtags: row.hashtags ?? "",
            format: row.format ?? "",
            items: (row.items as unknown[]) ?? [],
            updatedAt: row.updatedAt.toISOString(),
          };
        }
      }
      initialContent = {
        id: content.id,
        title: content.title,
        platform: content.platform,
        format: content.format,
        scheduledAt: content.scheduledAt,
        draftId: content.draftId,
        draft: draft
          ? {
              id: draft.id,
              platform: draft.platform,
              mediaType: draft.mediaType,
              mediaUrl: draft.mediaUrl ?? "",
              caption: draft.caption ?? "",
              hashtags: draft.hashtags ?? "",
              format: draft.format ?? "",
              items: (draft.items as unknown[]) ?? [],
              updatedAt: draft.updatedAt,
            }
          : null,
        ideaId: content.ideaId,
        copyId: content.copyId,
        goalId: content.goalId,
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Eye size={26} className="text-purple" />
          Preview Social
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Monte seu post e veja como ele ficaria no Instagram ou TikTok.
          Tudo fica local — nada é publicado.
        </p>
      </div>

      <PreviewSocial
        initialDrafts={drafts.map((d) => ({
          id: d.id,
          platform: d.platform,
          mediaType: d.mediaType,
          mediaUrl: d.mediaUrl ?? "",
          caption: d.caption ?? "",
          hashtags: d.hashtags ?? "",
          format: d.format ?? "",
          items: (d.items as unknown[]) ?? [],
          updatedAt: d.updatedAt.toISOString(),
        }))}
        copies={copies.map((c) => ({
          id: c.id,
          platform: c.platform,
          format: c.format,
          content: c.content,
          isFavorite: c.isFavorite,
          createdAt: c.createdAt.toISOString(),
        }))}
        initialContent={initialContent}
      />
    </div>
  );
}
