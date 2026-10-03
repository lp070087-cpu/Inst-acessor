"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Plus,
  Zap,
  XCircle,
  AlertCircle,
  ChevronDown,
  Image as ImageIcon,
  Instagram,
  Music2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

interface QueueItem {
  id: string;
  contentId: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  externalId: string | null;
  provider: string | null;
  createdAt: string;
}

interface ContentItem {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  /** Miniatura do rascunho vinculado (vem de PlannedContent.draftMediaUrl). */
  draftMediaUrl: string;
  draftMediaType: string;
}

interface LogItem {
  id: string;
  queueId: string | null;
  contentId: string | null;
  platform: string;
  operation: string;
  status: string;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  externalId: string | null;
  provider: string | null;
  createdAt: string;
}

interface PublishingClientProps {
  initial: {
    queue: QueueItem[];
    contents: ContentItem[];
  };
}

// ------------------------------------------------------------
// Constantes (identidade visual aprovada)
// ------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  AGENDADO: "Agendado",
  PROCESSANDO: "Processando",
  PUBLICADO: "Publicado",
  FALHOU: "Falhou",
  CANCELADO: "Cancelado",
};

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  AGENDADO: "info",
  PROCESSANDO: "warning",
  PUBLICADO: "success",
  FALHOU: "danger",
  CANCELADO: "neutral",
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

const FORMAT_LABEL: Record<string, string> = {
  post: "Post",
  carrossel: "Carrossel",
  reel: "Reel",
  story: "Story",
  video: "Vídeo",
};

const FILTERS = ["TODOS", "AGENDADO", "PROCESSANDO", "PUBLICADO", "FALHOU", "CANCELADO"] as const;

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlatformIcon({ platform }: { platform: string }) {
  return platform === "instagram" ? (
    <Instagram size={15} className="text-purple" />
  ) : (
    <Music2 size={15} className="text-purple" />
  );
}

/**
 * Miniatura da mídia do conteúdo planejado (vem do rascunho vinculado).
 * Sem mídia: marcador "Sem mídia" — nunca inventa imagem.
 */
function ContentThumb({ content }: { content: ContentItem | undefined }) {
  const url = content?.draftMediaUrl;
  const isVideo = content?.draftMediaType === "video";
  return (
    <span className="w-12 h-12 rounded-[10px] overflow-hidden bg-surface grid place-items-center flex-none border border-border-soft">
      {url ? (
        isVideo ? (
          <video src={url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        )
      ) : (
        <ImageIcon size={16} className="text-ink-muted" />
      )}
    </span>
  );
}

/**
 * Erro AMIGÁVEL para o usuário comum, preservando o detalhe técnico para o
 * admin (nunca escondemos o erro real — só o apresentamos em duas camadas).
 * O `errorCode` vem do adapter (ex.: "9007/… OAuthException").
 */
function friendlyPublishError(code: string | null, message: string | null): string {
  const raw = `${code ?? ""} ${message ?? ""}`;
  if (/9007|Media ID is not available/i.test(raw)) {
    return "Não foi possível concluir o envio da mídia ao Instagram.";
  }
  if (/190|OAuthException|access token/i.test(raw)) {
    return "Sua conexão com o Instagram expirou. Reconecte em Redes Sociais.";
  }
  if (/AUTH|token/i.test(code ?? "")) {
    return "Sua conexão com a plataforma expirou. Reconecte em Redes Sociais.";
  }
  if (/RATE_LIMIT/i.test(code ?? "")) {
    return "A plataforma está limitando publicações. Aguarde um pouco antes de tentar de novo.";
  }
  if (/VALIDATION/i.test(code ?? "")) {
    return "Este conteúdo não pode ser publicado no formato escolhido.";
  }
  if (/INTEGRATION_NOT_CONFIGURED/i.test(code ?? "")) {
    return "A publicação real não está disponível: conecte sua conta de rede social em Redes Sociais.";
  }
  return message || "Não foi possível concluir a publicação.";
}

/** Bloco de erro com detalhe técnico recolhível (visível para o admin). */
function PublishErrorBox({
  code,
  message,
  provider,
  externalId,
}: {
  code: string | null;
  message: string | null;
  provider: string | null;
  externalId: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const friendly = friendlyPublishError(code, message);
  const hasDetail = Boolean(code || provider || externalId);
  return (
    <div className="rounded-md bg-danger-soft border border-danger/15 px-3 py-2 flex flex-col gap-1.5">
      <div className="flex items-start gap-2 text-[12.5px] text-danger">
        <AlertCircle size={14} className="flex-none mt-0.5" />
        <span>{friendly}</span>
      </div>
      {hasDetail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="self-start inline-flex items-center gap-1 text-[11.5px] font-semibold text-danger/90 hover:text-danger cursor-pointer"
          >
            <ChevronDown size={12} className={cn("transition-transform duration-200", open && "rotate-180")} />
            Ver detalhes técnicos
          </button>
          {open && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px] text-ink-soft">
              {code && (
                <>
                  <dt className="font-semibold text-ink-muted">Código</dt>
                  <dd className="break-words">{code}</dd>
                </>
              )}
              {provider && (
                <>
                  <dt className="font-semibold text-ink-muted">Provider</dt>
                  <dd className="break-words">{provider}</dd>
                </>
              )}
              {externalId && (
                <>
                  <dt className="font-semibold text-ink-muted">ID externo</dt>
                  <dd className="break-words">{externalId}</dd>
                </>
              )}
              {message && (
                <>
                  <dt className="font-semibold text-ink-muted">Mensagem</dt>
                  <dd className="break-words">{message}</dd>
                </>
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

export function PublishingClient({ initial }: PublishingClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [queue, setQueue] = React.useState<QueueItem[]>(initial.queue);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("TODOS");
  const [platformFilter, setPlatformFilter] = React.useState<string>("TODAS");
  const [loading, setLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  const [scheduleContentId, setScheduleContentId] = React.useState<string>("");
  const [scheduleAt, setScheduleAt] = React.useState<string>("");
  const [view, setView] = React.useState<"fila" | "historico">("fila");
  const [logs, setLogs] = React.useState<LogItem[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  const contentById = React.useMemo(() => {
    const m = new Map<string, ContentItem>();
    for (const c of initial.contents) m.set(c.id, c);
    return m;
  }, [initial.contents]);

  const filtered = React.useMemo(() => {
    return queue.filter((q) => {
      if (filter !== "TODOS" && q.status !== filter) return false;
      if (platformFilter !== "TODAS" && q.platform !== platformFilter) return false;
      return true;
    });
  }, [queue, filter, platformFilter]);

  // Conteúdos que ainda NÃO estão na fila — oferecidos no seletor de agendar.
  const queuedKeys = React.useMemo(
    () => new Set(queue.map((q) => `${q.contentId}::${q.platform}`)),
    [queue]
  );
  const availableContents = React.useMemo(
    () => initial.contents.filter((c) => !queuedKeys.has(`${c.id}::${c.platform}`)),
    [initial.contents, queuedKeys]
  );

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/publishing");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQueue(data.items ?? []);
    } catch {
      toast("Não foi possível atualizar a fila.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/publishing/logs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      toast("Não foi possível carregar o histórico.", "error");
    } finally {
      setLogsLoading(false);
    }
  }

  React.useEffect(() => {
    if (view === "historico") void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function handleAction(id: string, action: "retry" | "cancel" | "open" | "preview") {
    if (action === "open") {
      const q = queue.find((x) => x.id === id);
      if (q) router.push(`/calendario?content=${q.contentId}`);
      return;
    }
    if (action === "preview") {
      const q = queue.find((x) => x.id === id);
      if (q) router.push(`/preview-social?content=${q.contentId}`);
      return;
    }
    setProcessingId(id);
    try {
      const res = await fetch(`/api/publishing?action=${action}&id=${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao executar ação.", "error");
        return;
      }
      toast(action === "retry" ? "Re-tentativa iniciada." : "Agendamento cancelado.");
      await reload();
    } catch {
      toast("Não foi possível executar a ação.", "error");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleProcess() {
    setProcessingId("__process__");
    try {
      const res = await fetch("/api/publishing?action=process", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao processar.", "error");
        return;
      }
      toast(
        data.processed > 0
          ? `${data.published} publicado(s), ${data.failed} com falha.`
          : "Nenhum item vencido na fila."
      );
      await reload();
    } catch {
      toast("Não foi possível processar.", "error");
    } finally {
      setProcessingId(null);
    }
  }

  /**
   * Aguarda o item sair de PROCESSANDO. `publishContent` devolve só depois de
   * falar com a API real do Instagram (pode levar alguns segundos), então a
   * tela recarrega em passos enquanto o status permanecer PROCESSANDO.
   */
  async function pollProcessing(contentId: string, platform: string): Promise<QueueItem[]> {
    let latest = queue;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch("/api/publishing");
      if (!res.ok) break;
      const data = await res.json();
      latest = (data.items ?? []) as QueueItem[];
      setQueue(latest);
      const item = latest.find((x) => x.contentId === contentId && x.platform === platform);
      if (!item || item.status !== "PROCESSANDO") break;
    }
    return latest;
  }

  function reportResult(item: QueueItem | undefined, fallbackMessage: string) {
    if (!item) {
      toast(fallbackMessage);
      return;
    }
    if (item.status === "PUBLICADO") {
      toast("Publicado com confirmação do Instagram.");
    } else if (item.status === "FALHOU") {
      toast(item.errorMessage ?? "A publicação falhou.", "error");
    } else {
      toast("Publicação em andamento.");
    }
  }

  async function handleSchedule(contentId: string, platform: string, scheduledAt: string) {
    const content = contentById.get(contentId);
    if (!content) return;
    setPublishingId(contentId);
    try {
      const res = await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          platform,
          format: content.format,
          scheduledAt: scheduledAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error ?? data.errorMessage ?? "Não foi possível agendar.", "error");
        return;
      }
      toast("Conteúdo agendado na fila.");
      await reload();
    } catch {
      toast("Não foi possível agendar.", "error");
    } finally {
      setPublishingId(null);
      setScheduleContentId("");
      setScheduleAt("");
    }
  }

  async function handlePublishNow(contentId: string, platform: string) {
    const content = contentById.get(contentId);
    if (!content) return;
    setPublishingId(contentId);
    try {
      const res = await fetch("/api/publishing?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, platform, format: content.format }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Não foi possível publicar.", "error");
        return;
      }
      // `publishContent` só responde depois da tentativa real; recarregamos
      // para ler o estado final (PUBLICADO ou FALHOU com o motivo real).
      const latest = await pollProcessing(contentId, platform);
      reportResult(
        latest.find((x) => x.contentId === contentId && x.platform === platform),
        data.errorMessage ?? "Publicação enviada ao Instagram."
      );
    } catch {
      toast("Não foi possível publicar.", "error");
    } finally {
      setPublishingId(null);
    }
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { TODOS: queue.length };
    for (const s of ["AGENDADO", "PROCESSANDO", "PUBLICADO", "FALHOU", "CANCELADO"]) {
      c[s] = queue.filter((q) => q.status === s).length;
    }
    return c;
  }, [queue]);

  return (
    <div className="flex flex-col gap-5">
      {/* ----------------------------------------------------------------
          AGENDAR UM CONTEÚDO PLANEJADO
          Sem este bloco a fila nunca recebia item: `scheduleContent` e
          `publishContent` existiam nas APIs mas nenhum ponto do app os
          chamava. Aqui o usuário escolhe um PlannedContent (do Calendário /
          Preview Social) e o coloca na fila — ou publica na hora.
          ---------------------------------------------------------------- */}
      <div className="rounded-md bg-card border border-border-soft p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-purple" />
          <span className="text-[13.5px] font-semibold text-ink">Agendar um conteúdo</span>
        </div>

        {availableContents.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            Todos os seus conteúdos planejados já estão na fila. Crie ou agende
            novos conteúdos pelo Calendário ou pelo Preview Social.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 min-w-[240px] flex-1">
              <span className="text-[11.5px] font-semibold text-ink-soft">Conteúdo planejado</span>
              <select
                value={scheduleContentId}
                onChange={(e) => setScheduleContentId(e.target.value)}
                className="text-[13px] rounded-[10px] border border-border-soft bg-surface px-3 py-2 text-ink"
              >
                <option value="">Selecione um conteúdo…</option>
                {availableContents.map((c) => (
                  <option key={`${c.id}::${c.platform}`} value={c.id}>
                    {c.title} · {PLATFORM_LABEL[c.platform] ?? c.platform} · {FORMAT_LABEL[c.format] ?? c.format}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-ink-soft">Data/hora (opcional)</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="text-[13px] rounded-[10px] border border-border-soft bg-surface px-3 py-2 text-ink"
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const c = availableContents.find((x) => x.id === scheduleContentId);
                if (c) void handleSchedule(c.id, c.platform, scheduleAt);
              }}
              disabled={!scheduleContentId || publishingId !== null}
            >
              {publishingId === scheduleContentId ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CalendarClock size={14} />
              )}
              Agendar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const c = availableContents.find((x) => x.id === scheduleContentId);
                if (c) void handlePublishNow(c.id, c.platform);
              }}
              disabled={!scheduleContentId || publishingId !== null}
            >
              {publishingId === scheduleContentId ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              Publicar agora
            </Button>
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-[10px] bg-surface p-0.5 border border-border-soft">
            {(["fila", "historico"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "text-[12.5px] font-semibold px-3 py-1.5 rounded-[8px] transition-all duration-300 cursor-pointer",
                  view === v ? "bg-ai-soft text-purple" : "text-ink-soft hover:text-ink"
                )}
              >
                {v === "fila" ? "Fila" : "Histórico"}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft font-semibold">
            <Clock size={14} /> {queue.length} {queue.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleProcess} disabled={processingId !== null}>
            {processingId === "__process__" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Processar vencidos
          </Button>
          <Button size="sm" variant="ghost" onClick={view === "fila" ? reload : loadLogs} disabled={loading || logsLoading}>
            <RefreshCw size={14} className={cn((loading || logsLoading) && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-pill border transition-all duration-300 cursor-pointer",
                filter === f
                  ? "bg-purple text-white border-purple"
                  : "bg-card text-ink-soft border-border-soft hover:text-ink"
              )}
            >
              {STATUS_LABEL[f] ?? f}
              <span className="ml-1.5 opacity-80 text-[11px]">({counts[f] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(["TODAS", "instagram", "tiktok"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                "text-[12px] font-semibold px-2.5 py-1 rounded-pill border transition-all duration-300 cursor-pointer",
                platformFilter === p
                  ? "bg-ai-soft text-purple border-purple/30"
                  : "bg-card text-ink-muted border-border-soft hover:text-ink"
              )}
            >
              {p === "TODAS" ? "Todas" : PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Histórico */}
      {view === "historico" ? (
        logsLoading && logs.length === 0 ? (
          <div className="grid place-items-center py-20 text-ink-muted">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhum evento registrado"
            description="Operações de publicação (agendar, publicar, cancelar, re-tentar) aparecerão aqui com status, tentativas e erros amigáveis."
          />
        ) : (
          // `overflow-x-auto` (era `overflow-hidden`): a tabela de logs tem 6
          // colunas; em telas pequenas ela precisa ROLAR dentro do card em vez
          // de empurrar o layout ou ser cortada.
          <div className="rounded-md bg-card border border-border-soft overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-surface/70">
                <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <th className="px-4 py-2.5">Quando</th>
                  <th className="px-4 py-2.5">Plataforma</th>
                  <th className="px-4 py-2.5">Operação</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Tentativas</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border-soft">
                    <td className="px-4 py-2.5 text-[12px] text-ink-soft">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <Badge size="xs" tone="neutral">{PLATFORM_LABEL[l.platform] ?? l.platform}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-ink break-words">{l.operation}</td>
                    <td className="px-4 py-2.5">
                      <Badge size="xs" tone={l.status === "success" ? "success" : l.status === "error" ? "danger" : "neutral"}>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-soft hidden sm:table-cell">{l.attempts}</td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-muted hidden md:table-cell">
                      {l.errorMessage || (l.externalId ? `id externo ${l.externalId}` : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : loading && queue.length === 0 ? (
        <div className="grid place-items-center py-20 text-ink-muted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={filter === "TODOS" ? "Nenhum item na fila" : `Nenhum item ${STATUS_LABEL[filter]?.toLowerCase()}`}
          description={
            filter === "TODOS"
              ? "Quando você agendar conteúdos pelo Calendário ou Preview Social, eles aparecem aqui para acompanhamento e retry."
              : "Nenhum conteúdo neste estado no momento."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const content = contentById.get(q.contentId);
            const tone = STATUS_TONE[q.status] ?? "neutral";
            return (
              <div
                key={q.id}
                className="rounded-md bg-card border border-border-soft p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <ContentThumb content={content} />
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlatformIcon platform={q.platform} />
                        <span className="text-[13.5px] font-semibold text-ink truncate">
                          {content?.title ?? "Conteúdo"}
                        </span>
                        <Badge size="xs" tone="neutral">{PLATFORM_LABEL[q.platform] ?? q.platform}</Badge>
                        <Badge size="xs" tone="neutral">{FORMAT_LABEL[q.format] ?? q.format}</Badge>
                        {content && !content.draftMediaUrl && (
                          <Badge size="xs" tone="warning">Sem mídia</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-ink-muted flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {fmtDateTime(q.scheduledAt)}
                        </span>
                        {q.nextAttemptAt && q.status === "AGENDADO" && (
                          <span className="inline-flex items-center gap-1">
                            <RefreshCw size={12} /> próxima tentativa {fmtDateTime(q.nextAttemptAt)}
                          </span>
                        )}
                        {q.attempts > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <AlertCircle size={12} /> {q.attempts} tentativa(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={tone}>{STATUS_LABEL[q.status] ?? q.status}</Badge>
                    {q.status === "PROCESSANDO" && <Loader2 size={14} className="animate-spin text-warn" />}
                    {q.status === "AGENDADO" && (
                      <Button
                        size="xs"
                        onClick={() => void handlePublishNow(q.contentId, q.platform)}
                        disabled={publishingId !== null}
                      >
                        {publishingId === q.contentId ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Zap size={13} />
                        )}
                        Publicar agora
                      </Button>
                    )}
                  </div>
                </div>

                {(q.errorMessage || q.errorCode) && (
                  <PublishErrorBox
                    code={q.errorCode}
                    message={q.errorMessage}
                    provider={q.provider}
                    externalId={q.externalId}
                  />
                )}
                {q.externalId && (
                  <div className="rounded-md bg-success-soft border border-success/15 px-3 py-2 text-[12.5px] text-success flex items-center gap-2">
                    <CheckCircle2 size={14} className="flex-none" />
                    <span>Confirmado pela plataforma · id externo {q.externalId}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {q.status === "FALHOU" && (
                    <Button size="xs" variant="outline" onClick={() => handleAction(q.id, "retry")} disabled={processingId === q.id}>
                      {processingId === q.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Re-tentar
                    </Button>
                  )}
                  {(q.status === "AGENDADO" || q.status === "FALHOU") && (
                    <Button size="xs" variant="ghost" onClick={() => handleAction(q.id, "cancel")} disabled={processingId === q.id}>
                      <XCircle size={13} />
                      Cancelar
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => handleAction(q.id, "open")}>
                    <ExternalLink size={13} />
                    Abrir no Calendário
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => handleAction(q.id, "preview")}>
                    <Send size={13} />
                    Abrir no Preview Social
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
