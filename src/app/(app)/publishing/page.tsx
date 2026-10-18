import type { Metadata } from "next";
import { Send } from "lucide-react";

import { requireOnboardedSession, requirePremiumPage } from "@/lib/auth/guard";
import { listQueue } from "@/lib/publishing";
import { listPlannedContent } from "@/lib/planning";
import { PageHeader } from "@/components/layout/page-header";
import { PublishingClient } from "@/components/publishing/publishing-client";

export const metadata: Metadata = {
  title: "Central de Publicação",
  description: "Acompanhe e gerencie a fila de publicação do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  await requirePremiumPage();
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Fila de publicação + conteúdos planejados (para exibir título/mídia).
  const [queue, contents] = await Promise.all([
    listQueue(userId),
    listPlannedContent(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Send}
        title="Central de Publicação"
        description="Acompanhe o que está agendado, processando, publicado, falhou ou foi cancelado. Nada é publicado por tempo — sempre com confirmação real."
      />

      <PublishingClient
        initial={{
          queue: queue.map((q) => ({
            id: q.id,
            contentId: q.contentId,
            platform: q.platform,
            format: q.format,
            status: q.status,
            scheduledAt: q.scheduledAt,
            attempts: q.attempts,
            lastAttemptAt: q.lastAttemptAt,
            nextAttemptAt: q.nextAttemptAt,
            errorCode: q.errorCode,
            errorMessage: q.errorMessage,
            externalId: q.externalId,
            provider: q.provider,
            createdAt: q.createdAt,
          })),
          contents: contents.map((c) => ({
            id: c.id,
            title: c.title,
            platform: c.platform,
            format: c.format,
            status: c.status,
            scheduledAt: c.scheduledAt,
            // Mídia do rascunho vinculado — alimenta a miniatura na Central.
            draftMediaUrl: c.draftMediaUrl ?? "",
            draftMediaType: c.draftMediaType ?? "",
          })),
        }}
      />
    </div>
  );
}
