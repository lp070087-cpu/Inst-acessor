import type { Metadata } from "next";
import { MessageSquareHeart } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { getOrCreateRule } from "@/lib/comment-replies/db";
import {
  CommentRepliesClient,
  type InitialRule,
} from "@/components/comment-replies/comment-replies-client";
import type { ReplyMode } from "@/lib/comment-replies/types";

export const metadata: Metadata = {
  title: "Respostas Inteligentes",
  description: "Responda comentários do Instagram com inteligência artificial.",
};

export const dynamic = "force-dynamic";

/**
 * Respostas Inteligentes a comentários do Instagram.
 *
 * Servidor: descobre se o Instagram está conectado (reutilizando a MESMA
 * conexão de Redes Sociais — não há segundo OAuth) e carrega a configuração
 * existente. Cliente: toda a interação.
 *
 * Se não houver conexão, a tela mostra um CTA para /redes-sociais em vez de
 * esconder a funcionalidade.
 */
export default async function RespostasInteligentesPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Conexão social real (mesma fonte usada pelo Redes Sociais).
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
    select: { id: true, status: true, username: true },
  });

  const connected = connection?.status === "CONNECTED";

  // A configuração é lida apenas quando há conexão — evita criar registro
  // vazio para quem só quer ver a tela de CTA.
  const rule = connected ? await getOrCreateRule(userId) : null;

  const configured = await aiConfigured();

  const mediaCount = connected
    ? await prisma.instagramMedia.count({ where: { userId } })
    : 0;

  const initialRule: InitialRule | null = rule
    ? {
        id: rule.id,
        enabled: rule.enabled,
        paused: rule.paused,
        replyMode: rule.replyMode as ReplyMode,
        maxRepliesPerRun: rule.maxRepliesPerRun,
        maxRepliesPerHour: rule.maxRepliesPerHour,
        maxRepliesPerDay: rule.maxRepliesPerDay,
        minimumIntervalSeconds: rule.minimumIntervalSeconds,
        targetType: rule.targetType,
        mediaId: rule.mediaId,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <MessageSquareHeart size={26} className="text-purple" />
          Respostas Inteligentes
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          A IA lê os comentários dos seus posts, carrosséis e Reels, sugere a
          resposta no seu tom e só publica o que você autorizar.
        </p>
      </div>

      <CommentRepliesClient
        connected={connected}
        instagramUsername={connection?.username ?? null}
        aiConfigured={configured}
        mediaCount={mediaCount}
        initialRule={initialRule}
      />
    </div>
  );
}
