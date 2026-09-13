import type { Metadata } from "next";
import { Send } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listQueue } from "@/lib/publishing";
import { listPlannedContent } from "@/lib/planning";
import { PublishingClient } from "@/components/publishing/publishing-client";

export const metadata: Metadata = {
  title: "Central de Publicação",
  description: "Acompanhe e gerencie a fila de publicação do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Fila de publicação + conteúdos planejados (para exibir título/mídia).
  const [queue, contents] = await Promise.all([
    listQueue(userId),
    listPlannedContent(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Send size={26} className="text-purple" />
          Central de Publicação
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Acompanhe o que está agendado, processando, publicado, falhou ou foi
          cancelado. Nada é publicado por tempo — sempre com confirmação real.
        </p>
      </div>

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
          })),
        }}
      />
    </div>
  );
}
