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
  XCircle,
  AlertCircle,
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

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { TODOS: queue.length };
    for (const s of ["AGENDADO", "PROCESSANDO", "PUBLICADO", "FALHOU", "CANCELADO"]) {
      c[s] = queue.filter((q) => q.status === s).length;
    }
    return c;
  }, [queue]);

  return (
    <div className="flex flex-col gap-5">
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
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlatformIcon platform={q.platform} />
                      <span className="text-[13.5px] font-semibold text-ink truncate">
                        {content?.title ?? "Conteúdo"}
                      </span>
                      <Badge size="xs" tone="neutral">{PLATFORM_LABEL[q.platform] ?? q.platform}</Badge>
                      <Badge size="xs" tone="neutral">{FORMAT_LABEL[q.format] ?? q.format}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-ink-muted">
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
                  <div className="flex items-center gap-2">
                    <Badge tone={tone}>{STATUS_LABEL[q.status] ?? q.status}</Badge>
                    {q.status === "PROCESSANDO" && <Loader2 size={14} className="animate-spin text-warn" />}
                  </div>
                </div>

                {q.errorMessage && (
                  <div className="rounded-md bg-danger-soft border border-danger/15 px-3 py-2 text-[12.5px] text-danger flex items-start gap-2">
                    <AlertCircle size={14} className="flex-none mt-0.5" />
                    <span>{q.errorMessage}</span>
                  </div>
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
