"use client";

import * as React from "react";
import { Loader2, History, CheckCircle2, Clock, EyeOff, AlertTriangle, Bot, Hand } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";

import type { ReplyStatus } from "@/lib/comment-replies/types";

/**
 * HISTÓRICO
 * =========
 * Filtros exatamente como definidos pelo produto: todos, enviados, pendentes,
 * ignorados, com erro, manuais e automáticos.
 *
 * "Manual" e "Automático" são derivados de `sourceRule` — os dois terminam com
 * status SENT, então o filtro é aplicado no cliente sobre a lista carregada.
 */

interface LogRow {
  id: string;
  mediaId: string;
  commentId: string;
  commenterUsername: string;
  originalComment: string;
  commentCategory: string | null;
  generatedReply: string | null;
  finalReply: string | null;
  status: string;
  sourceRule: string | null;
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
}

type FilterId = "ALL" | "SENT" | "PENDING" | "IGNORED" | "ERROR" | "MANUAL" | "AUTO";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "SENT", label: "Enviados" },
  { id: "PENDING", label: "Pendentes" },
  { id: "IGNORED", label: "Ignorados" },
  { id: "ERROR", label: "Com erro" },
  { id: "MANUAL", label: "Manuais" },
  { id: "AUTO", label: "Automáticos" },
];

const CATEGORY_LABEL: Record<string, string> = {
  emoji: "Emoji",
  elogio: "Elogio",
  agradecimento: "Agradecimento",
  pergunta_simples: "Pergunta simples",
  duvida_produto: "Dúvida de produto",
  reclamacao: "Reclamação",
  critica: "Crítica",
  ofensivo: "Ofensivo",
  sensivel: "Sensível",
  spam: "Spam",
  outro: "Outro",
};

function statusMeta(status: string): { label: string; tone: "success" | "warning" | "neutral" | "danger"; Icon: typeof CheckCircle2 } {
  switch (status) {
    case "SENT":
      return { label: "Enviado", tone: "success", Icon: CheckCircle2 };
    case "PENDING":
      return { label: "Pendente", tone: "warning", Icon: Clock };
    case "IGNORED":
      return { label: "Ignorado", tone: "neutral", Icon: EyeOff };
    case "ERROR":
      return { label: "Erro", tone: "danger", Icon: AlertTriangle };
    case "APPROVED":
      return { label: "Aprovado", tone: "warning", Icon: Clock };
    case "SKIPPED":
      return { label: "Não respondido", tone: "neutral", Icon: EyeOff };
    default:
      return { label: status, tone: "neutral", Icon: Clock };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel() {
  const [filter, setFilter] = React.useState<FilterId>("ALL");
  const [logs, setLogs] = React.useState<LogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comment-replies/history?status=ALL&limit=200", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível carregar o histórico.");
        return;
      }
      setLogs(data.logs ?? []);
    } catch {
      setError("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // O filtro é aplicado localmente sobre a lista já carregada — assim trocar de
  // aba é instantâneo e não refaz requisição a cada clique.
  const filtered = React.useMemo(() => {
    switch (filter) {
      case "MANUAL":
        return logs.filter((l) => l.status === "SENT" && l.sourceRule === "MANUAL");
      case "AUTO":
        return logs.filter((l) => l.status === "SENT" && l.sourceRule === "AUTO");
      case "ALL":
        return logs;
      default:
        return logs.filter((l) => l.status === (filter as ReplyStatus));
    }
  }, [logs, filter]);

  const counts = React.useMemo(
    () => ({
      ALL: logs.length,
      SENT: logs.filter((l) => l.status === "SENT").length,
      PENDING: logs.filter((l) => l.status === "PENDING").length,
      IGNORED: logs.filter((l) => l.status === "IGNORED").length,
      ERROR: logs.filter((l) => l.status === "ERROR").length,
      MANUAL: logs.filter((l) => l.status === "SENT" && l.sourceRule === "MANUAL").length,
      AUTO: logs.filter((l) => l.status === "SENT" && l.sourceRule === "AUTO").length,
    }),
    [logs]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-[13.5px] text-ink-soft py-12 justify-center">
        <Loader2 size={17} className="animate-spin" />
        Carregando histórico…
      </div>
    );
  }

  if (error) {
    return <ErrorState description={error} retry={() => void load()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={FILTERS.map((f) => ({
          id: f.id,
          label: counts[f.id] ? `${f.label} (${counts[f.id]})` : f.label,
        }))}
        activeId={filter}
        onChange={(id) => setFilter(id as FilterId)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nada por aqui"
          description="Nenhum registro corresponde a este filtro."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((log) => {
            const meta = statusMeta(log.status);
            const Icon = meta.Icon;
            return (
              <li
                key={log.id}
                className="bg-card border border-border-soft rounded-md shadow-xs p-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={meta.tone} size="xs">
                    <Icon size={10} />
                    {meta.label}
                  </Badge>

                  {log.status === "SENT" && (
                    <Badge tone="neutral" size="xs">
                      {log.sourceRule === "AUTO" ? <Bot size={10} /> : <Hand size={10} />}
                      {log.sourceRule === "AUTO" ? "Automático" : "Manual"}
                    </Badge>
                  )}

                  {log.commentCategory && (
                    <Badge tone="neutral" size="xs">
                      {CATEGORY_LABEL[log.commentCategory] ?? log.commentCategory}
                    </Badge>
                  )}

                  <span className="text-[11.5px] text-ink-muted ml-auto">
                    {formatDate(log.sentAt ?? log.createdAt)}
                  </span>
                </div>

                <p className="text-[12.5px] text-ink-muted mt-2.5">
                  {log.commenterUsername ? `@${log.commenterUsername}` : "Comentário"}
                </p>
                <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                  {log.originalComment}
                </p>

                {log.finalReply ? (
                  <div className="mt-2.5 pt-2.5 border-t border-border-soft">
                    <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                      Resposta publicada
                    </p>
                    <p className="text-[13px] text-ink mt-1 leading-relaxed">
                      {log.finalReply}
                    </p>
                  </div>
                ) : log.generatedReply ? (
                  <div className="mt-2.5 pt-2.5 border-t border-border-soft">
                    <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                      Sugestão (não enviada)
                    </p>
                    <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                      {log.generatedReply}
                    </p>
                  </div>
                ) : null}

                {log.status === "ERROR" && log.errorCode && (
                  <p className="text-[11.5px] text-danger mt-2">
                    Motivo técnico: {log.errorCode}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
