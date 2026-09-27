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
  Pencil,
  X,
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

interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatClientProps {
  aiConfigured: boolean;
  initialConversations: ConversationListItem[];
  initialMessages: ChatMessageDTO[];
  activeConversationId: string | null;
  userName?: string | null;
}

/*
 * CAMPO DE MENSAGEM — de onde vêm os números (item 9)
 * ==================================================
 * A régua de altura vive na `className` do textarea (`min-h-[92px]
 * sm:min-h-[90px]`), não numa constante em JS: o script de crescimento lê o
 * TETO do CSS com `getComputedStyle`, então existe um lugar só para cada valor
 * e a media query não pode divergir do código.
 *
 * As contas abaixo usam os valores EXTRAÍDOS do CSS compilado pelo Tailwind
 * (não estimados): `py-3` = 12px por lado, `border` = 1px, `box-sizing:
 * border-box`, e a altura de linha herdada do body = 1.6 (o preflight do
 * Tailwind faz `line-height: inherit` nos controles, e `line-height: 1.6` está
 * no html/body — nenhuma classe `leading-*` é aplicada aqui de propósito).
 *
 * ANTES — `rows={2}`, sem `min-h`:
 *     mobile  (sem classe de fonte; preflight = 100% → 16px):
 *         2 × 16 × 1.6 + 24 + 2 = 77,2px
 *     desktop (`text-[14px]`):
 *         2 × 14 × 1.6 + 24 + 2 = 70,8px
 *
 * AGORA — `min-h` vence a altura natural nos dois casos:
 *     mobile  — 92px → +19,2%   (pedido: +15–20%)
 *     desktop — 90px → +27,1%   (pedido: +25–30%)
 *
 * `rows={2}` foi MANTIDO de propósito: com `rows={3}` a altura NATURAL passaria
 * a 102,8px no celular e 93,2px no desktop, ou seja o atributo venceria o
 * `min-h` e o ganho sairia da faixa pedida. Com `rows={2}` quem manda na altura
 * de partida é o `min-h`; o `rows` fica só como base do `<textarea>` e como
 * tamanho de referência para leitores de tela.
 *
 * Estes são valores de PARTIDA e de TETO; a altura real de um texto longo é
 * medida em tempo de execução pelo `scrollHeight` em `autoGrow`.
 */

/**
 * Chat IA Acessor — client component.
 * Sem IA configurada → estado controlado "IA ainda não configurada".
 * Com IA → chat com histórico, nova conversa, excluir, renomear e continuar.
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

  // ITEM 10 — renomear conversa (a atual e as anteriores).
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [savingRename, setSavingRename] = React.useState(false);
  // Salvaguarda contra o `blur` que dispara DEPOIS de cancelar (Esc / botão X):
  // sem ela, o cancelamento voltaria a gravar o texto que o usuário descartou.
  const renameCancelledRef = React.useRef(false);

  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /**
   * ITEM 9 — crescimento automático do campo de mensagem.
   *
   * Como funciona: `height = auto` devolve o campo ao tamanho do conteúdo, e o
   * `scrollHeight` lido logo em seguida é a altura real do texto. O `+2` é a
   * borda, que o `scrollHeight` NÃO inclui.
   *
   * O teto é lido do PRÓPRIO CSS (`max-h-[…]`) via `getComputedStyle`, e não de
   * uma segunda constante em JS: assim a media query do teto existe em um lugar
   * só e os dois nunca divergem. `max-height: none` → `NaN` → sem teto.
   */
  const autoGrow = React.useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = parseFloat(window.getComputedStyle(el).maxHeight as string);
    const limit = Number.isFinite(cap) ? cap : Number.POSITIVE_INFINITY;
    const needed = el.scrollHeight + 2;
    el.style.height = `${Math.min(needed, limit)}px`;
    // Passou do teto: rola por dentro em vez de empurrar a página.
    el.style.overflowY = needed > limit ? "auto" : "hidden";
  }, []);

  // Cresce ao digitar E ao limpar (depois de enviar, o campo volta ao tamanho
  // de partida — sem isto, um texto longo deixaria a caixa grande e vazia).
  React.useEffect(() => {
    autoGrow();
  }, [input, autoGrow]);

  // A largura muda entre mobile/desktop (e na rotação do celular), e o texto
  // reflui: o campo precisa ser remedido, senão sobra uma linha de vazio.
  React.useEffect(() => {
    window.addEventListener("resize", autoGrow);
    return () => window.removeEventListener("resize", autoGrow);
  }, [autoGrow]);

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
    // Renomear e trocar de conversa ao mesmo tempo gravaria o nome na conversa
    // errada: sair da edição aqui é mais seguro que confiar na ordem dos cliques.
    setRenamingId(null);
  }

  async function openConversation(id: string) {
    if (renamingId === id) return;
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
      if (renamingId === id) setRenamingId(null);
      toast("Conversa excluída.");
    } catch {
      toast("Erro ao excluir conversa.", "error");
    }
  }

  // ------------------------------------------------------------
  // ITEM 10 — renomear
  // ------------------------------------------------------------

  function startRename(id: string, currentTitle: string) {
    renameCancelledRef.current = false;
    setRenamingId(id);
    setRenameDraft(currentTitle);
  }

  function cancelRename() {
    // Marca ANTES de desmontar o campo: o `blur` que dispara na saída não pode
    // ser confundido com "o usuário confirmou".
    renameCancelledRef.current = true;
    setRenamingId(null);
    setRenameDraft("");
  }

  /**
   * Grava o novo nome. Regras (as mesmas do servidor, em
   * `normalizeConversationTitle`):
   *  • vazio / só espaços → cancela e NADA é gravado (não inventamos nome nem
   *    sobrescrevemos o atual com string vazia);
   *  • a tela só mostra o nome que o SERVIDOR confirmou — o `PATCH` devolve o
   *    título realmente gravado, e é ele que entra na lista.
   *  • falhou? a edição continua aberta com o texto digitado, para o usuário
   *    não perder o que escreveu.
   */
  async function commitRename(id: string) {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }

    const draft = renameDraft.replace(/\s+/g, " ").trim();
    if (!draft) {
      cancelRename();
      return;
    }
    if (savingRename) return;

    // Nome igual ao atual: nada a fazer, e evitar uma escrita inútil no banco.
    const current = conversations.find((c) => c.id === id)?.title ?? null;
    if (current === draft) {
      setRenamingId(null);
      setRenameDraft("");
      return;
    }

    setSavingRename(true);
    try {
      const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Não foi possível renomear a conversa.", "error");
        return;
      }

      const saved = typeof data.title === "string" && data.title.length > 0 ? data.title : draft;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: saved } : c)));
      setRenamingId(null);
      setRenameDraft("");
      toast("Conversa renomeada.");
    } catch {
      toast("Não foi possível renomear a conversa.", "error");
    } finally {
      setSavingRename(false);
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

  const activeTitle =
    (activeId ? conversations.find((c) => c.id === activeId)?.title : null) ?? null;

  return (
    // ITEM 8 — a coluna lateral cresceu (280 → 300px) para caber o nome completo
    // da conversa e as ações sem apertar o texto, e as duas colunas ficam
    // alinhadas pelo topo (`items-start`) para a lateral não esticar junto com
    // uma conversa longa.
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 xl:gap-5 items-start">
      {/* Histórico lateral (desktop) */}
      {/* `lg:sticky`: a lista acompanha a rolagem. Numa conversa longa, antes era
          preciso voltar ao topo da página para trocar de conversa. */}
      <aside className="hidden lg:flex flex-col gap-2 lg:sticky lg:top-6 min-w-0">
        <Button variant="outline" className="justify-start gap-2" onClick={newConversation}>
          <Plus size={16} />
          Nova conversa
        </Button>
        {/* ITEM 7 — `dvh` no lugar de `vh` também aqui: no iOS `vh` mede a tela
            SEM a barra de endereço, então a lista ficava alguns pixels mais
            alta que a área visível e a última conversa escapava para fora.
            `supports-[height:100dvh]` mantém o `vh` como rede em navegador
            antigo (mesmo padrão já usado na caixa de mensagens). */}
        <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto overscroll-contain pr-1 max-h-[calc(100vh-12rem)] supports-[height:100dvh]:max-h-[calc(100dvh-12rem)]">
          {conversations.length === 0 && (
            <p className="text-[13px] text-ink-muted px-2 py-3">
              Nenhuma conversa ainda.
            </p>
          )}
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              renaming={renamingId === c.id}
              savingRename={savingRename}
              draft={renameDraft}
              onDraftChange={setRenameDraft}
              onOpen={() => openConversation(c.id)}
              onStartRename={() => startRename(c.id, c.title)}
              onCommitRename={() => commitRename(c.id)}
              onCancelRename={cancelRename}
              onDelete={() => removeConversation(c.id)}
            />
          ))}
        </div>
      </aside>

      {/* Histórico mobile (modal simples) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[90] flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} />
          {/* `w-[19rem]` (304px) acompanha a coluna do desktop: o nome da
              conversa + o lápis + a lixeira não cabiam em 288px. */}
          <div className="relative z-10 w-[19rem] max-w-[85vw] bg-card h-full p-4 shadow-lg flex flex-col min-w-0">
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
            <div className="flex flex-col gap-1.5 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {conversations.length === 0 && (
                <p className="text-[13px] text-ink-muted px-2 py-3">Nenhuma conversa ainda.</p>
              )}
              {conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  renaming={renamingId === c.id}
                  savingRename={savingRename}
                  draft={renameDraft}
                  onDraftChange={setRenameDraft}
                  onOpen={() => openConversation(c.id)}
                  onStartRename={() => startRename(c.id, c.title)}
                  onCommitRename={() => commitRename(c.id)}
                  onCancelRename={cancelRename}
                  onDelete={() => removeConversation(c.id)}
                  alwaysShowActions
                />
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
        {/* Barra superior — item 8: agora é um cartão de verdade. Antes o título
            flutuava solto sobre o fundo e, em telas largas, parecia desconectado
            da conversa abaixo. */}
        {/* BLOCO 5 — o título vem do nome da conversa, que é gerado pelo
            usuário/IA e pode ser longo. Sem `min-w-0` na coluna de texto, esse
            título empurrava o botão "Conversas" (e a própria página) para além
            da tela. `min-w-0` deixa o título quebrar, o botão fica `flex-none`
            com o rótulo escondido só no espaço mais apertado. */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-card border border-border-soft shadow-xs px-3.5 py-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-bold text-ink">IA Acessor</h2>
            {activeTitle ? (
              <p className="text-[13px] text-ink-soft break-words" title={activeTitle}>
                {activeTitle}
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft break-words">
                Converse com a IA sobre seu perfil
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-none">
            {/* ITEM 10 — renomear a conversa ATUAL, sem ter de abrir o histórico. */}
            {activeId && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const current = conversations.find((c) => c.id === activeId);
                  if (current) startRename(current.id, current.title);
                }}
                aria-label="Renomear conversa atual"
                title="Renomear conversa"
              >
                <Pencil size={15} />
                <span className="hidden md:inline">Renomear</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <MessageSquare size={16} />
              Conversas
            </Button>
          </div>
        </div>

        {/* Mensagens — item 8: a área de leitura ficou mais alta (a resposta
            costuma passar de meia tela) e o teto usa `dvh` quando o navegador
            entende `dvh`, com o `vh` como rede: no iOS a barra de endereço muda
            de altura ao rolar, e `100vh` é MAIOR que a área visível — o último
            trecho da resposta ficava escondido atrás da barra. */}
        <div className="flex flex-col gap-3 rounded-xl bg-card border border-border-soft shadow-xs p-3.5 sm:p-4 min-h-[340px] sm:min-h-[420px] max-h-[58vh] supports-[height:100dvh]:max-h-[62dvh] overflow-y-auto overscroll-contain min-w-0">
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

        {/* Campo de mensagem — itens 8 e 9 */}
        {/* BLOCO 5 — `min-w-0` no textarea: um campo de texto é um item de flex
            com `min-width: auto`, ou seja, a sua largura mínima era
            `size` (o atributo HTML, ~20 caracteres) e não zero. Em 320/360px
            isso somado ao botão "Enviar" ultrapassava a largura do card. Também
            ajustamos o padding no celular para o par caber sem apertar. */}
        <div className="pb-[env(safe-area-inset-bottom)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2.5 rounded-xl bg-card border border-border-soft shadow-xs p-2.5 sm:p-3"
          >
            <textarea
              ref={composerRef}
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
              // ITEM 9 — `min-h`/`max-h` formam a régua do crescimento; o script
              // (`autoGrow`) só estica até o teto e liga a rolagem depois dele.
              // ITEM 7 — o piso de 16px no celular NÃO está declarado aqui: ele
              // vive UMA vez, em `globals.css` (`@media (max-width: 639.98px)`),
              // que é o único lugar que sabe por que existe (o zoom do iOS ao
              // focar). Declarar de novo aqui criaria duas réguas para a mesma
              // regra — e a de cá venceria a de lá silenciosamente.
              // Sem `leading-*`: a altura de linha herdada (1.6) é o que sustenta
              // a conta documentada acima; trocá-la aqui mudaria a altura sem que
              // nenhum dos valores de `min-h` acompanhasse.
              className="flex-1 min-w-0 resize-none rounded-[12px] border border-border bg-bg-ice px-3 sm:px-4 py-3 sm:text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow min-h-[92px] sm:min-h-[90px] max-h-[208px] sm:max-h-[240px] overflow-y-hidden"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="gap-2 flex-none px-3 sm:px-4 mb-0.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </form>
          <div className="flex items-center justify-between gap-3 px-1 mt-1.5 min-h-[18px]">
            <span className="hidden sm:inline text-[11.5px] text-ink-muted">
              Enter envia · Shift + Enter quebra linha
            </span>
            {/* Contador só quando está perto do limite real do servidor
                (4000 caracteres em `chatCreateSchema`): antes disso é ruído. */}
            {input.length > 3600 && (
              <span className="text-[11.5px] font-semibold text-ink-muted">
                {input.length}/4000
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ITEM 10 — linha de conversa na lista, com renomear e excluir.
 *
 * Por que virou componente: a linha existia DUAS vezes (lateral do desktop e
 * gaveta do celular) e as duas passariam a precisar de renomear. Uma cópia só
 * multiplicaria por dois qualquer divergência futura — foi assim que a lista do
 * desktop e a do celular já tinham diferenças de rótulo de acessibilidade.
 *
 * HTML válido: a linha é um `<div>`, e QUEM abre a conversa é um `<button>` com
 * o nome. Antes a linha inteira era clicável e os botões ficavam dentro dela —
 * o que impediria um campo de edição ali (não se aninha campo/botão em botão).
 */
function ConversationRow({
  conversation,
  active,
  renaming,
  savingRename,
  draft,
  onDraftChange,
  onOpen,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  alwaysShowActions = false,
}: {
  conversation: ConversationListItem;
  active: boolean;
  renaming: boolean;
  savingRename: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onOpen: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  /** No celular não existe hover: as ações ficam sempre visíveis. */
  alwaysShowActions?: boolean;
}) {
  const actionsVisibility = alwaysShowActions
    ? "opacity-100"
    : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
        active ? "bg-ai-soft text-purple" : "hover:bg-surface text-ink-soft"
      )}
    >
      <MessageSquare size={15} className="flex-none" />

      {renaming ? (
        <input
          // `autoFocus` + selecionar tudo: renomear começa com o nome atual
          // marcado, então digitar substitui em vez de exigir apagar antes.
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelRename();
            }
          }}
          onBlur={onCommitRename}
          maxLength={200}
          aria-label="Nome da conversa"
          // ITEM 7 — sem tamanho de fonte no celular pelo mesmo motivo do campo
          // de mensagem: o piso de 16px é declarado uma vez em `globals.css`.
          className="flex-1 min-w-0 rounded-md border border-purple/40 bg-bg-ice px-2 py-1 sm:text-[13px] font-medium text-ink focus:border-purple/60 focus:ring-2 focus:ring-purple/20 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          title={conversation.title}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <span className="block truncate text-[13px] font-medium">{conversation.title}</span>
          <span className="block text-[11px] text-ink-muted">
            {conversation.messageCount === 1
              ? "1 mensagem"
              : `${conversation.messageCount} mensagens`}
          </span>
        </button>
      )}

      <span className={cn("flex items-center gap-1 flex-none transition-opacity", actionsVisibility)}>
        {renaming ? (
          <>
            {/* `onMouseDown` + `preventDefault` nos dois botões: sem isso o
                clique tira o foco do campo, o `blur` grava, e aí o botão age
                sobre um estado que já mudou — o "cancelar" salvaria. */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onCommitRename();
              }}
              disabled={savingRename}
              className="text-ink-muted hover:text-purple disabled:opacity-50 cursor-pointer flex-none"
              aria-label="Salvar nome"
            >
              {savingRename ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onCancelRename();
              }}
              className="text-ink-muted hover:text-danger cursor-pointer flex-none"
              aria-label="Cancelar renomear"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartRename}
              className="text-ink-muted hover:text-purple cursor-pointer flex-none"
              aria-label={`Renomear conversa ${conversation.title}`}
              title="Renomear conversa"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-ink-muted hover:text-danger cursor-pointer flex-none"
              aria-label={`Excluir conversa ${conversation.title}`}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </span>
    </div>
  );
}
