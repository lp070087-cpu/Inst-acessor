"use client";

import * as React from "react";
import { ExternalLink, Loader2, AlertTriangle, Info } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  INSIGHT_TABS,
  META_UNAVAILABLE_MESSAGE,
  type InsightTab,
  type InsightMetric,
} from "@/lib/publishing/media-insights";

/**
 * INSIGHTS DE UMA PUBLICAÇÃO (PARTES 10 e 11)
 * ============================================
 * Aberto pelo botão "Abrir" da publicação, substituindo o link direto para o
 * Instagram. Três abas: Visão geral · Engajamento · Público.
 *
 * Honestidade é a regra da tela:
 *  - Métrica sem valor mostra a FRASE OFICIAL, não "0" nem "—".
 *  - A origem do número fica visível (nó da mídia, /insights, comentários
 *    sincronizados ou soma derivada), para o número ser auditável.
 *  - A aba Público explica que a API não fornece o recorte em vez de fingir.
 *  - O link para o Instagram continua disponível, como ação secundária.
 */

interface MediaInsightsResponse {
  found: boolean;
  media: {
    igMediaId: string;
    format: string;
    caption: string | null;
    permalink: string | null;
    timestamp: string | null;
  } | null;
  tabs: Record<InsightTab, InsightMetric[]> | null;
  measuredCount: number;
  totalCount: number;
  hasMissingInsights: boolean;
  hasStoredMetrics: boolean;
  storedCommentsCount: number | null;
}

const SOURCE_LABEL: Record<InsightMetric["source"], string> = {
  media: "Informado na publicação",
  insights: "Insights da Meta",
  "comentarios-sincronizados": "Comentários sincronizados",
  derivado: "Soma calculada",
};

function formatValue(value: number | null): string {
  if (value == null) return META_UNAVAILABLE_MESSAGE;
  return new Intl.NumberFormat("pt-BR").format(value);
}

function MetricRow({ metric }: { metric: InsightMetric }) {
  const missing = metric.value == null;

  return (
    <div className="rounded-[12px] border border-border-soft bg-card px-4 py-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <span className="text-[12.5px] font-semibold text-ink-soft min-w-0 break-words">
          {metric.label}
        </span>
        <span
          className={cn(
            "font-data font-bold flex-none text-right",
            missing ? "text-[11.5px] font-semibold text-ink-muted max-w-[190px]" : "text-[19px] text-ink"
          )}
        >
          {formatValue(metric.value)}
        </span>
      </div>
      <p className="text-[11.5px] text-ink-muted leading-relaxed">{metric.hint}</p>
      {!missing && (
        <Badge tone="neutral" size="xs" className="self-start">
          {SOURCE_LABEL[metric.source]}
        </Badge>
      )}
    </div>
  );
}

export function MediaInsightsModal({
  open,
  mediaId,
  formatHint,
  onClose,
}: {
  open: boolean;
  /** ID externo da mídia (o mesmo que o botão "Abrir" já conhece). */
  mediaId: string | null;
  /** Formato já conhecido na lista, para o cabeçalho não ficar vazio no load. */
  formatHint?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<InsightTab>("visao-geral");
  const [data, setData] = React.useState<MediaInsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !mediaId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(
          `/api/publishing/media-insights?mediaId=${encodeURIComponent(mediaId as string)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as MediaInsightsResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Não foi possível carregar os insights.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Falha de conexão ao carregar os insights.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, mediaId]);

  // Volta para a primeira aba a cada publicação: manter a aba anterior daria a
  // impressão de que os dados da nova publicação estão naquela seção.
  React.useEffect(() => {
    if (open) setTab("visao-geral");
  }, [open, mediaId]);

  const metrics = data?.tabs?.[tab] ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Insights da publicação" size="lg">
      <div className="flex flex-col gap-4">
        {/* Cabeçalho — formato real e legenda real */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="brand" size="sm">
                {data?.media?.format ?? formatHint ?? "Publicação"}
              </Badge>
              {data?.media?.timestamp && (
                <span className="text-[12px] text-ink-muted">
                  {new Date(data.media.timestamp).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
            {data?.media?.caption && (
              <p className="text-[12.5px] text-ink-soft mt-1.5 line-clamp-2 leading-relaxed">
                {data.media.caption}
              </p>
            )}
          </div>

          {data?.media?.permalink && (
            <a
              href={data.media.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-ink-soft hover:text-purple transition-colors inline-flex items-center gap-1.5 px-2 py-1 flex-none"
            >
              <ExternalLink size={13} />
              Ver no Instagram
            </a>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-ink-muted text-[13px]">
            <Loader2 size={16} className="animate-spin" />
            Carregando insights…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md bg-warn-soft border border-warn/20 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="flex-none mt-0.5 text-warn" />
            <p className="text-[12.5px] text-ink-soft">{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            <Tabs
              tabs={INSIGHT_TABS.map((t) => ({ id: t.id, label: t.label }))}
              activeId={tab}
              onChange={(id) => setTab(id as InsightTab)}
            />

            {metrics.length === 0 ? (
              <p className="text-[13px] text-ink-muted rounded-xl border border-dashed border-[#D0D4DB] bg-surface/30 px-4 py-6 text-center">
                {META_UNAVAILABLE_MESSAGE}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {metrics.map((m) => (
                  <MetricRow key={m.key} metric={m} />
                ))}
              </div>
            )}

            {/* Transparência: quantas métricas têm valor e por que faltam */}
            <div className="rounded-[12px] bg-surface/40 border border-border-soft px-4 py-3 flex items-start gap-2.5">
              <Info size={15} className="flex-none mt-0.5 text-ink-muted" />
              <div className="min-w-0">
                <p className="text-[12.5px] text-ink-soft leading-relaxed">
                  {data.measuredCount} de {data.totalCount} métricas desta publicação
                  têm valor informado pela Meta.
                  {data.hasMissingInsights &&
                    ` As demais exibem a frase "${META_UNAVAILABLE_MESSAGE}" em vez de zero, porque a Meta não as disponibilizou para esta publicação.`}
                </p>
                {!data.hasStoredMetrics && (
                  <p className="text-[12px] text-ink-muted mt-1">
                    Esta publicação ainda não tem nenhuma coleta de insights registrada.
                    Sincronize a conta em Redes Sociais para tentar obtê-los.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
