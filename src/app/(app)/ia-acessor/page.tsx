import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listConversations, getConversation } from "@/lib/ai/services";
import { ChatClient } from "@/components/ai/chat-client";

export const metadata: Metadata = {
  title: "IA Acessor",
  description: "Sua mentoria com inteligência artificial, baseada nos dados reais do seu perfil.",
};

export const dynamic = "force-dynamic";

export default async function IaAcessorPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const configured = aiConfigured();

  // Conversas reais do usuário
  const convs = configured ? await listConversations(userId) : [];
  const active = convs[0] ?? null;
  const activeFull = active ? await getConversation(userId, active.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Sparkles size={26} className="text-purple" />
          IA Acessor
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Sua mentoria com IA — responde com base no seu perfil e nas métricas reais
          disponíveis. Nada de dados inventados.
        </p>
      </div>

      <ChatClient
        aiConfigured={configured}
        initialConversations={convs.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
          messageCount: c.messages?.length ?? 0,
        }))}
        initialMessages={
          activeFull
            ? activeFull.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt.toISOString(),
              }))
            : []
        }
        activeConversationId={activeFull?.id ?? null}
        userName={session.user.name}
      />
    </div>
  );
}
