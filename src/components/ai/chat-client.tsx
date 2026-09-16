"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  MessageSquare,
  Plus,
  Trash2,
  Loader2,
  Bot,
  User,
  Copy as CopyIcon,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { cn } from "@/lib/utils";

export interface ChatMessageDTO {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessageDTO[];
}

interface ChatClientProps {
  aiConfigured: boolean;
  initialConversations: {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }[];
  initialMessages: ChatMessageDTO[];
  activeConversationId: string | null;
  userName?: string | null;
}

/**
 * Chat IA Acessor — client component.
 * Sem IA configurada → estado controlado "IA ainda não configurada".
 * Com IA → chat com histórico, nova conversa, excluir, continuar.
 */
export function ChatClient({
  aiConfigured,
  initialConversations,
  initialMessages,
  activeConversationId,
  userName,
}: ChatClientProps) {
  const { toast } = useToast();

  const [conversations, setConversations] = React.useState(initialConversations);
  const [messages, setMessages] = React.useState<ChatMessageDTO[]>(initialMessages);
  const [activeId, setActiveId] = React.useState<string | null>(activeConversationId);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setLoading(true);
    // optimistic user message
    const tempUser: ChatMessageDTO = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeId ?? undefined,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
        toast(data.message ?? data.error ?? "Erro ao gerar resposta.", "error");
        return;
      }

      // Atualiza mensagens com a resposta real (sem duplicar a do usuário)
      setMessages(data.conversation.messages);

      // Atualiza a lista de conversas
      setActiveId(data.conversation.id);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === data.conversation.id);
        const updated = {
          id: data.conversation.id,
          title: data.conversation.title,
          updatedAt: data.conversation.updatedAt,
          messageCount: data.conversation.messages.length,
        };
        const rest = prev.filter((c) => c.id !== data.conversation.id);
        return [updated, ...rest];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      toast("Não foi possível conectar com a IA.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      // Guarda o ID da mensagem (não o texto): a confirmação é comparada com
      // `m.id` no render, então guardar o conteúdo nunca acenderia o "Copiada".
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  }

  async function openConversation(id: string) {
    setLoading(true);
    setSidebarOpen(false);
    try {
      const res = await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao carregar conversa.", "error");
        return;
      }
      setActiveId(data.id);
      setMessages(data.messages);
    } catch {
      toast("Erro ao carregar conversa.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeConversation(id: string) {
    try {
      const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("Erro ao excluir conversa.", "error");
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      toast("Conversa excluída.");
    } catch {
      toast("Erro ao excluir conversa.", "error");
    }
  }

  if (!aiConfigured) {
    return (
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
        <EmptyState
          icon={Sparkles}
          title="IA ainda não configurada"
          description="Para usar a IA Acessor, adicione uma chave de API (OpenAI ou Gemini) nas variáveis de ambiente do projeto. Nenhum dado fictício é usado enquanto isso."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
      {/* Histórico lateral (desktop) */}
      <aside className="hidden lg:flex flex-col gap-2">
        <Button variant="outline" className="justify-start gap-2" onClick={newConversation}>
          <Plus size={16} />
          Nova conversa
        </Button>
        <div className="flex flex-col gap-1.5 mt-2 max-h-[70vh] overflow-y-auto pr-1">
          {conversations.length === 0 && (
            <p className="text-[13px] text-ink-muted px-2 py-3">
              Nenhuma conversa ainda.
            </p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                c.id === activeId
                  ? "bg-ai-soft text-purple"
                  : "hover:bg-surface text-ink-soft"
              )}
              onClick={() => openConversation(c.id)}
            >
              <MessageSquare size={15} className="flex-none" />
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium">
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeConversation(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-danger transition-opacity cursor-pointer flex-none"
                aria-label="Excluir conversa"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Histórico mobile (modal simples) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[90] flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-72 max-w-[80vw] bg-card h-full p-4 shadow-lg flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-3 flex-none">
              <span className="text-[13.5px] font-semibold text-ink">Conversas</span>
              <Button variant="ghost" size="xs" onClick={newConversation}>
                <Plus size={14} /> Nova
              </Button>
            </div>
            {/* `flex-1 min-h-0` em vez de `max-h-[80vh]`: o drawer já tem
                altura total, então a lista precisa ocupar o espaço restante
                e rolar dentro dele — 80vh somava com o cabeçalho e cortava
                as últimas conversas em telas baixas. */}
            <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
              {conversations.length === 0 && (
                <p className="text-[13px] text-ink-muted px-2 py-3">Nenhuma conversa ainda.</p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer",
                    c.id === activeId ? "bg-ai-soft text-purple" : "hover:bg-surface text-ink-soft"
                  )}
                  onClick={() => openConversation(c.id)}
                >
                  <MessageSquare size={15} className="flex-none" />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{c.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeConversation(c.id);
                    }}
                    className="text-ink-muted hover:text-danger cursor-pointer flex-none"
                    aria-label="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Área do chat */}
      {/* `min-w-0`: item de grid tem `min-width:auto` — uma resposta longa da
          IA (ou um trecho sem espaços) empurrava a coluna e criava rolagem
          horizontal na página. */}
      <div className="flex flex-col gap-4 min-w-0">
        {/* Barra superior */}
        {/* BLOCO 5 — o título vem do nome da conversa, que é gerado pelo
            usuário/IA e pode ser longo. Sem `min-w-0` na coluna de texto, esse
            título empurrava o botão "Conversas" (e a própria página) para além
            da tela. `min-w-0` deixa o título quebrar, o botão fica `flex-none`
            com o rótulo escondido só no espaço mais apertado. */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-bold text-ink">
              IA Acessor
            </h2>
            <p className="text-[13px] text-ink-soft break-words">
              {activeId
                ? conversations.find((c) => c.id === activeId)?.title ?? "Conversa"
                : "Converse com a IA sobre seu perfil"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden flex-none"
            onClick={() => setSidebarOpen(true)}
          >
            <MessageSquare size={16} />
            Conversas
          </Button>
        </div>

        {/* Mensagens */}
        <div className="flex flex-col gap-3 rounded-lg bg-card border border-border-soft shadow-xs p-4 min-h-[320px] sm:min-h-[380px] max-h-[60vh] overflow-y-auto min-w-0">
          {messages.length === 0 && !loading && (
            <div className="flex-1 grid place-items-center">
              <EmptyState
                icon={Bot}
                title={userName ? `Olá, ${userName}!` : "Olá!"}
                description="Pergunte sobre seu perfil, seu nicho, ideias de conteúdo ou métricas disponíveis. A IA responde apenas com dados reais que você autorizou."
                className="border-none bg-transparent"
              />
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "group flex items-start gap-2.5 max-w-[85%]",
                m.role === "assistant" ? "" : "self-end flex-row-reverse"
              )}
            >
              <span
                className={cn(
                  "w-7 h-7 rounded-[10px] grid place-items-center flex-none",
                  m.role === "assistant"
                    ? "bg-ai-soft text-purple"
                    : "bg-surface text-ink-muted"
                )}
              >
                {m.role === "assistant" ? <Bot size={15} /> : <User size={15} />}
              </span>
              <div className="min-w-0 flex flex-col items-start gap-1">
                <div
                  className={cn(
                    // `min-w-0 break-words`: filho de flex tem `min-width:auto` e
                    // não encolhe abaixo do seu conteúdo. Como a bolha é limitada
                    // a `max-w-[85%]`, uma palavra longa (URL, token) estourava a
                    // largura em vez de quebrar.
                    "min-w-0 break-words rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed",
                    m.role === "assistant"
                      ? "bg-surface/70 text-ink"
                      : "bg-brand-grad text-white"
                  )}
                >
                  {m.role === "assistant" ? (
                    // A resposta chega em Markdown. Renderizar como elementos
                    // React (nunca HTML) evita o `**negrito**` literal na tela
                    // sem abrir caminho para injeção.
                    <MarkdownLite content={m.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
                {m.role === "assistant" && m.content.trim().length > 0 && (
                  <button
                    onClick={() => copyMessage(m.id, m.content)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[11.5px] font-semibold text-ink-muted hover:text-purple transition-opacity cursor-pointer flex items-center gap-1 px-1"
                    aria-label="Copiar resposta"
                  >
                    {copiedId === m.id ? <Check size={12} /> : <CopyIcon size={12} />}
                    {copiedId === m.id ? "Copiada" : "Copiar"}
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-[10px] bg-ai-soft text-purple grid place-items-center flex-none">
                <Bot size={15} />
              </span>
              <div className="rounded-[14px] bg-surface/70 px-4 py-3">
                <Loader2 size={16} className="animate-spin text-purple" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        {/* BLOCO 5 — `min-w-0` no textarea: um campo de texto é um item de flex
            com `min-width: auto`, ou seja, a sua largura mínima era
            `size` (o atributo HTML, ~20 caracteres) e não zero. Em 320/360px
            isso somado ao botão "Enviar" ultrapassava a largura do card. Também
            ajustamos o padding no celular para o par caber sem apertar. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2.5 pb-[env(safe-area-inset-bottom)]"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Escreva sua mensagem..."
            className="flex-1 min-w-0 resize-none rounded-[12px] border border-border bg-bg-ice px-3 sm:px-4 py-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="gap-2 flex-none px-3 sm:px-4"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span className="hidden sm:inline">Enviar</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
