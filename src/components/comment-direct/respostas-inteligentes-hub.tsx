"use client";

import * as React from "react";
import { MessageSquareText, MessagesSquare, Zap } from "lucide-react";

import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CommentRepliesClient,
  type InitialRule,
} from "@/components/comment-replies/comment-replies-client";
import { DirectInbox } from "./direct-inbox";
import { DirectAutomations } from "./direct-automations";

/**
 * HUB — RESPOSTAS INTELIGENTES
 * ============================
 * Três áreas DENTRO da mesma seção (NENHUM item novo na sidebar):
 *
 *   • Comentários — o motor já existente (4 sub-abas: Publicações · Aprovações ·
 *     Regras · Histórico). É renderizado SEM alteração; só fica sob a aba.
 *   • Direct — a Central de DM (conversas reais, sugestão de IA, envio manual).
 *   • Automações — Comentário → Direct, FAQ automático e ajustes da IA.
 *
 * A separação é deliberada: comentário (resposta pública) e Direct (mensagem
 * privada) são produtos distintos, com permissões e riscos diferentes. Misturar
 * os dois na mesma tela faria o usuário achar que respondeu em público quando
 * respondeu no privado.
 */

type Section = "comentarios" | "direct" | "automacoes";

interface HubProps {
  connected: boolean;
  instagramUsername: string | null;
  aiConfigured: boolean;
  mediaCount: number;
  initialRule: InitialRule | null;
  /**
   * Aba inicial (vinda do SERVIDOR via `?section=`). A tela de Automações (ponte)
   * aponta para `?section=automacoes` para o usuário cair direto na aba certa em
   * vez de na primeira. Resolvido no servidor porque a página é dinâmica — um
   * `useSearchParams` no cliente exigiria fronteira de Suspense.
   */
  initialSection?: Section;
}

export function RespostasInteligentesHub({
  connected,
  instagramUsername,
  aiConfigured,
  mediaCount,
  initialRule,
  initialSection = "comentarios",
}: HubProps) {
  const [section, setSection] = React.useState<Section>(initialSection);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        tabs={[
          { id: "comentarios", label: "Comentários" },
          { id: "direct", label: "Direct" },
          { id: "automacoes", label: "Automações" },
        ]}
        activeId={section}
        onChange={(id) => setSection(id as Section)}
        className="self-start"
      />

      {section === "comentarios" && (
        <CommentRepliesClient
          connected={connected}
          instagramUsername={instagramUsername}
          aiConfigured={aiConfigured}
          mediaCount={mediaCount}
          initialRule={initialRule}
        />
      )}

      {section === "direct" && (
        <DirectInbox
          connected={connected}
          instagramUsername={instagramUsername}
          aiConfigured={aiConfigured}
        />
      )}

      {section === "automacoes" && (
        <DirectAutomations connected={connected} aiConfigured={aiConfigured} />
      )}
    </div>
  );
}

/** Rótulo curto reutilizável (mantém os ícones exportáveis para consistência). */
export const HUB_SECTION_ICONS = {
  comentarios: MessageSquareText,
  direct: MessagesSquare,
  automacoes: Zap,
} as const;

export const HUB_SECTION_DEFAULT_CLASS = cn(
  "text-[13.5px]",
  "text-ink-soft"
);
