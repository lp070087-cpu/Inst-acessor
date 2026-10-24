"use client";

import * as React from "react";
import Link from "next/link";
import {
  Instagram,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Lock,
  ShieldCheck,
  ArrowLeft,
  MessageSquare,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Divider } from "@/components/ui/divider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * CENTRAL DE DM (Direct) — PAINEL DE CONVERSAS
 * ============================================
 * Layout de dois painéis no desktop (lista + conversa) e navegação por painel
 * no celular. Só exibe dados REAIS vindos dos endpoints oficiais da Meta.
 *
 * Quando a permissão de mensagens não foi concedida (App Review pendente), o
 * painel mostra explicitamente "integração pendente" — nunca uma conversa de
 * exemplo. Nenhum texto é enviado sem o humano clicar em Enviar.
 */

interface ConversationItem {
  id: string;
  igConversationId: string;
  participantId: string | null;
  participantUsername: string | null;
  participantName: string | null;
  lastMessageAt: string | null;
  unreadCount: number | null;
  lastMessagePreview: string | null;
  windowOpen: boolean | null;
}

interface MessageItem {
  id: string;
  direction: string;
  text: string | null;
  attachmentType: string | null;
  sentAt: string | null;
  fromUs: boolean;
}

interface DirectInboxProps {
  connected: boolean;
  instagramUsername: string | null;
  aiConfigured: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function DirectInbox({ connected, instagramUsername, aiConfigured }: DirectInboxProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [permissionGranted, setPermissionGranted] = React.useState<boolean | null>(null);
  const [pendingNotice, setPendingNotice] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // No celular, mostra um painel por vez: lista OU conversa.
  const [mobileView, setMobileView] = React.useState<"list" | "chat">("list");

  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [suggesting, setSuggesting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [onlyUnread, setOnlyUnread] = React.useState(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/comment-direct/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPermissionGranted(typeof data.canManageMessages === "boolean" ? data.canManageMessages : null);
      setPendingNotice(data.pendingNotice ?? null);
    } catch {
      /* estado é informativo */
    }
  }, []);

  const loadConversations = React.useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/comment-direct/conversations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível carregar as conversas.", "error");
        return;
      }
      setConversations(data.conversations ?? []);
      setPermissionGranted(Boolean(data.permissionGranted));
      if (data.code === "capability") {
        toast("O Instagram ainda não liberou o acesso ao Direct desta conta.", "info");
      }
    } catch {
      toast("Não foi possível carregar as conversas.", "error");
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  const loadMessages = React.useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      setSuggestion(null);
      try {
        const res = await fetch(
          `/api/comment-direct/conversations/${encodeURIComponent(conversationId)}/messages`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          toast(data?.error ?? "Não foi possível carregar as mensagens.", "error");
          return;
        }
        setMessages(data.messages ?? []);
      } catch {
        toast("Não foi possível carregar as mensagens.", "error");
      } finally {
        setMessagesLoading(false);
      }
    },
    [toast]
  );

  React.useEffect(() => {
    if (!connected) return;
    void loadStatus();
    void loadConversations();
    setLoading(false);
  }, [connected, loadStatus, loadConversations]);

  function openConversation(c: ConversationItem) {
    setActiveId(c.id);
    setMobileView("chat");
    void loadMessages(c.id);
  }

  async function runSuggestion() {
    if (!active) return;
    setSuggesting(true);
    try {
      const res = await fetch(
        `/api/comment-direct/conversations/${encodeURIComponent(active.id)}/suggest`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      const data = await res.json();
      if (!res.ok || !data.suggestion) {
        toast(data?.error ?? "Não foi possível gerar a sugestão.", data?.code === "no_incoming" ? "info" : "warning");
        return;
      }
      setSuggestion(data.suggestion);
      setDraft(data.suggestion);
      if (data.faq) {
        toast(`Sugestão baseada na sua resposta sobre "${data.faq.question}".`);
      }
    } catch {
      toast("Não foi possível gerar a sugestão.", "error");
    } finally {
      setSuggesting(false);
    }
  }

  async function send() {
    if (!active) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/comment-direct/conversations/${encodeURIComponent(active.id)}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            approvedFromSuggestion: suggestion != null && suggestion === text,
            suggestion: suggestion ?? null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível enviar a mensagem.", "error");
        return;
      }
      setDraft("");
      setSuggestion(null);
      toast("Mensagem enviada.");
      await loadMessages(active.id);
      await loadConversations();
    } catch {
      toast("Não foi possível enviar a mensagem.", "error");
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------- sem conexão

  if (!connected) {
    return (
      <EmptyState
        icon={Instagram}
        title="Conecte seu Instagram para usar o Direct"
        description="A Central de DM usa a mesma conexão de Redes Sociais. Nenhuma autorização nova é pedida aqui — se o Instagram já está conectado, ele aparece automaticamente."
        action={
          <Link href="/redes-sociais">
            <Button variant="primary" size="md">Ir para Redes Sociais</Button>
          </Link>
        }
      />
    );
  }

  const filtered = conversations.filter((c) => {
    if (onlyUnread && !(c.unreadCount && c.unreadCount > 0)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.participantUsername ?? "").toLowerCase().includes(q) ||
      (c.participantName ?? "").toLowerCase().includes(q) ||
      (c.lastMessagePreview ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de estado + permissão */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-soft bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-[11px] bg-ai-soft text-purple grid place-items-center flex-none">
            <MessageSquare size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">
              {instagramUsername ? `@${instagramUsername}` : "Instagram conectado"}
            </p>
            <p className="text-[12px] text-ink-muted">
              {conversations.length} conversa(s) conhecida(s)
            </p>
          </div>
        </div>
        <Button variant="ghost" size="xs" onClick={() => void loadConversations()} disabled={syncing}>
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Atualizar
        </Button>
      </div>

      {/* Integração pendente — nunca uma conversa falsa no lugar */}
      {permissionGranted === false && (
        <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info-soft px-4 py-3.5">
          <Lock size={18} className="text-info flex-none mt-0.5" />
          <div className="text-[12.5px] text-ink-soft leading-relaxed min-w-0 flex-1 break-words">
            <strong className="text-ink">Integração pendente.</strong>{" "}
            {pendingNotice ??
              "O Instagram ainda não liberou a leitura e o envio de mensagens privadas nesta conta. A tela fica pronta e passa a funcionar quando a Meta liberar o acesso."}
          </div>
        </div>
      )}

      {/* Layout 2 colunas (desktop) / 1 painel (mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[520px]">
        {/* -------- Lista de conversas -------- */}
        <div
          className={cn(
            "rounded-md border border-border-soft bg-card overflow-hidden flex flex-col",
            mobileView === "chat" && "hidden lg:flex"
          )}
        >
          <div className="p-3 border-b border-border-soft flex flex-col gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa"
                className="w-full pl-8 pr-3 py-2 rounded-[10px] border border-border-soft bg-bg text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlyUnread((v) => !v)}
              className={cn(
                "self-start text-[11.5px] font-semibold px-2.5 py-1 rounded-pill border transition-colors",
                onlyUnread
                  ? "bg-ai-soft text-purple border-purple/20"
                  : "bg-surface text-ink-soft border-border-soft"
              )}
            >
              {onlyUnread ? "Mostrando não lidas" : "Só não lidas"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {syncing && conversations.length === 0 ? (
              <div className="flex items-center justify-center gap-2 text-[13px] text-ink-soft py-10">
                <Loader2 size={16} className="animate-spin" /> Carregando conversas…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] text-ink-soft">
                  {conversations.length === 0
                    ? "Nenhuma conversa conhecida ainda. Atualize para ler as conversas do Instagram."
                    : "Nenhuma conversa corresponde ao filtro."}
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const unread = c.unreadCount && c.unreadCount > 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c)}
                    className={cn(
                      "w-full text-left px-3.5 py-3 border-b border-border-soft transition-colors",
                      c.id === activeId ? "bg-ai-soft/50" : "hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink truncate">
                        {c.participantUsername
                          ? `@${c.participantUsername}`
                          : c.participantName ?? "Contato"}
                      </span>
                      <span className="text-[11px] text-ink-muted flex-none">
                        {relativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 min-w-0">
                      <span className="text-[12px] text-ink-soft truncate flex-1">
                        {c.lastMessagePreview ?? "…"}
                      </span>
                      {unread && (
                        <Badge tone="brand" size="xs">{c.unreadCount}</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* -------- Conversa -------- */}
        <div
          className={cn(
            "rounded-md border border-border-soft bg-card flex flex-col overflow-hidden",
            mobileView === "list" && "hidden lg:flex"
          )}
        >
          {!active ? (
            <div className="flex-1 grid place-items-center px-6 py-16 text-center">
              <div>
                <span className="w-14 h-14 rounded-[18px] bg-surface text-ink-muted grid place-items-center mx-auto mb-4">
                  <MessageSquare size={24} strokeWidth={1.8} />
                </span>
                <p className="text-[13.5px] text-ink-soft">
                  Escolha uma conversa para ver o histórico.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 h-14 border-b border-border-soft flex-none">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="lg:hidden text-ink-soft hover:text-ink"
                  aria-label="Voltar para a lista"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink truncate">
                    {active.participantUsername
                      ? `@${active.participantUsername}`
                      : active.participantName ?? "Contato"}
                  </p>
                  <p className="text-[11.5px] text-ink-muted">
                    {active.windowOpen === false
                      ? "Janela de 24h encerrada"
                      : active.windowOpen === true
                        ? "Janela de resposta aberta"
                        : "Estado da janela não informado"}
                  </p>
                </div>
                {active.windowOpen === false && <Badge tone="warning" size="xs">Janela fechada</Badge>}
              </div>

              {/* Histórico */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 bg-surface/30">
                {messagesLoading ? (
                  <div className="flex items-center justify-center gap-2 text-[13px] text-ink-soft py-10">
                    <Loader2 size={16} className="animate-spin" /> Carregando mensagens…
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted text-center py-10">
                    Nenhuma mensagem registrada nesta conversa.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.fromUs ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[78%] rounded-[14px] px-3.5 py-2 text-[13px] leading-relaxed break-words",
                          m.fromUs
                            ? "bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] text-white"
                            : "bg-card border border-border-soft text-ink"
                        )}
                      >
                        {m.text ? (
                          m.text
                        ) : (
                          <span className="italic opacity-80">
                            {m.attachmentType ? `[${m.attachmentType}]` : "[mensagem sem texto]"}
                          </span>
                        )}
                        <div
                          className={cn(
                            "text-[10.5px] mt-1",
                            m.fromUs ? "text-white/70" : "text-ink-muted"
                          )}
                        >
                          {relativeTime(m.sentAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sugestão da IA (humano aprova) */}
              {suggestion && (
                <div className="px-4 py-2 border-t border-border-soft bg-ai-soft/40 flex items-start gap-2">
                  <Sparkles size={15} className="text-purple flex-none mt-0.5" />
                  <p className="text-[12px] text-ink-soft leading-relaxed flex-1 min-w-0">
                    <strong className="text-ink">Sugestão da IA</strong> — revise antes de enviar.
                  </p>
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-border-soft p-3 flex flex-col gap-2 flex-none">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  maxLength={900}
                  placeholder={
                    active.windowOpen === false
                      ? "A janela de resposta desta conversa já fechou."
                      : "Escreva a resposta…"
                  }
                  className="w-full px-3.5 py-2.5 rounded-[10px] border border-border-soft bg-bg text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30 resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void runSuggestion()}
                    disabled={suggesting || !aiConfigured}
                    title={!aiConfigured ? "A IA precisa estar configurada pelo administrador." : "Gera uma sugestão para você revisar"}
                  >
                    {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Sugerir com IA
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void send()}
                    disabled={sending || !draft.trim() || active.windowOpen === false}
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Enviar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Divider />
      <div className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-4 py-3.5">
        <ShieldCheck size={18} className="text-success flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed min-w-0 break-words">
          O Inst Acessor só lê e envia mensagens pelos canais oficiais do Instagram e
          apenas quando a permissão correspondente está concedida. Nenhuma conversa é
          inventada: se a Meta não entrega, a tela mostra a integração como pendente.
          As sugestões da IA nunca são enviadas sem a sua aprovação, e o envio respeita
          a janela de 24 horas do Instagram.
        </p>
      </div>
    </div>
  );
}
