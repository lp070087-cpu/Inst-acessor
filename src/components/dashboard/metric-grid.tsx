"use client";

import { useState } from "react";
import {
  Users,
  Heart,
  Radar,
  Play,
  Clapperboard,
  Eye,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Film,
  CircleDashed,
  Info,
} from "lucide-react";

import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { EvolutionChart } from "@/components/dashboard/evolution-chart";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { ProductionBlock } from "@/components/dashboard/production-block";
import type { DashboardInstagramData } from "@/lib/dashboard/instagram-data";
import type { MediaProductionData } from "@/lib/dashboard/media-production";
import type { DeterministicInsight } from "@/lib/dashboard/insights";

const EVOLUTION_TABS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];

const EVOLUTION_METRICS: {
  id: "followersCount" | "reach" | "impressions" | "profileViews" | "mediaCount";
  label: string;
}[] = [
  { id: "followersCount", label: "Seguidores" },
  { id: "reach", label: "Alcance" },
  { id: "impressions", label: "Visualizações" },
  { id: "profileViews", label: "Visitas ao perfil" },
];

interface MetricGridProps {
  data: DashboardInstagramData;
  /** Mídia + produção (Reels, Stories, "Sua produção"). */
  media: MediaProductionData;
  /** Observações derivadas só de dados reais — funcionam sem IA. */
  insights: DeterministicInsight[];
  /** A IA central está configurada? Nunca expõe chave, só o booleano. */
  aiConfigured: boolean;
}

/**
 * Métricas do Dashboard — alimentado por dados REAIS (server component).
 *
 * A primeira linha segue a prioridade pedida:
 *   1. Seguidores · 2. Engajamento · 3. Alcance 7d
 *   4. Visualizações · 5. Reels · 6. Stories
 *
 * Nunca inventa números: quando a coleta não traz o dado, o card mostra "—"
 * ou um valor explicitamente explicado — jamais um zero falso.
 */
export function MetricGrid({ data, media, insights, aiConfigured }: MetricGridProps) {
  const { connected, cards, evolution, comparison, timeline, lastSyncAt } = data;
  const [tab, setTab] = useState("7d");
  const [metric, setMetric] = useState<(typeof EVOLUTION_METRICS)[number]["id"]>(
    "followersCount"
  );

  const period = (tab as "7d" | "30d" | "90d") in evolution ? (tab as "7d" | "30d" | "90d") : "7d";
  const activeMetric = EVOLUTION_METRICS.find((m) => m.id === metric) ?? EVOLUTION_METRICS[0];
  const points = evolution[period] ?? [];

  /** Hint de um card com dado real: mostra a variação, senão explica a espera. */
  function hintFor(card: { changePercent: number | null }, fallback = "Aguardando dados do Instagram."): string {
    if (card.changePercent != null) {
      return `${card.changePercent >= 0 ? "+" : ""}${card.changePercent.toFixed(1)}% desde o último sync`;
    }
    if (!connected) return "Conecte seu Instagram para liberar esta métrica.";
    return fallback;
  }

  // Timeline (melhores dias) — calculado server-side, exibido aqui
  type TimelineItem = {
    label: string;
    icon: typeof Radar;
    value: string;
    date: string;
  };
  const timelineItems: TimelineItem[] = [];
  if (timeline.bestReachDay) {
    timelineItems.push({
      label: "Melhor dia de alcance",
      icon: Radar,
      value: formatCompact(timeline.bestReachDay.value),
      date: formatDate(timeline.bestReachDay.date),
    });
  }
  if (timeline.biggestDailyGain) {
    timelineItems.push({
      label: "Maior ganho de seguidores",
      icon: TrendingUp,
      value: `+${formatCompact(timeline.biggestDailyGain.value)}`,
      date: formatDate(timeline.biggestDailyGain.date),
    });
  }
  if (timeline.biggestFollowerPeak) {
    timelineItems.push({
      label: "Pico de seguidores",
      icon: Award,
      value: formatCompact(timeline.biggestFollowerPeak.value),
      date: formatDate(timeline.biggestFollowerPeak.date),
    });
  }

  /**
   * Primeira linha — ordem exata pedida. Duas métricas não têm lastro na
   * coleta atual e são tratadas com estado vazio explícito, sem número falso:
   *   • Engajamento  → `snapshot.engagement` é gravado como null pelo sync;
   *   • Reels/Stories→ a integração não distingue Reels nem lê Stories.
   */
  const rowCards: {
    key: string;
    label: string;
    icon: typeof Users;
    value: string;
    hint: string;
    empty: boolean;
    emptyMessage?: string;
  }[] = [
    {
      key: "followers",
      label: "Seguidores",
      icon: Users,
      value: cards.followers.available ? formatCompact(cards.followers.value) : "—",
      hint: hintFor(cards.followers),
      empty: !connected,
    },
    {
      key: "engagement",
      label: "Engajamento (média)",
      icon: Heart,
      // Média REAL de curtidas + comentários por publicação coletada.
      value:
        media.avgInteractionsPerMedia != null
          ? formatCompact(media.avgInteractionsPerMedia)
          : "—",
      hint:
        media.avgInteractionsPerMedia != null
          ? "Média de curtidas + comentários por publicação"
          : !connected
            ? "Conecte seu Instagram para liberar esta métrica."
            : "Aguardando publicações coletadas.",
      empty: !connected,
    },
    {
      key: "reach7d",
      label: "Alcance 7d",
      icon: Radar,
      value: cards.reach7d.available ? formatCompact(cards.reach7d.value) : "—",
      hint: cards.reach7d.available
        ? data.reach7dDays > 0
          ? `${data.reach7dDays} ${data.reach7dDays === 1 ? "dia" : "dias"} de alcance somados${
              cards.reach7d.changePercent != null
                ? ` · ${cards.reach7d.changePercent >= 0 ? "+" : ""}${cards.reach7d.changePercent.toFixed(1)}% vs. semana anterior`
                : ""
            }`
          : "Aguardando dados do Instagram."
        : hintFor(cards.reach7d, "Aguardando dados do Instagram."),
      empty: !connected,
    },
    {
      key: "impressions",
      // "Visualizações" reaproveita `impressions` — equivalente real já
      // persistido pela integração. Não existe segunda sincronização.
      label: "Visualizações",
      icon: Play,
      value: cards.impressions.available ? formatCompact(cards.impressions.value) : "—",
      hint: hintFor(cards.impressions),
      empty: !connected,
    },
    {
      key: "reels",
      label: "Vídeos publicados",
      icon: Film,
      value: media.reels.count != null ? formatCompact(media.reels.count) : "—",
      hint:
        media.reels.count != null
          ? media.reels.videoViews != null
            ? `${formatCompact(media.reels.videoViews)} views nos vídeos`
            : "Views dos vídeos ainda não retornadas pela API."
          : !connected
            ? "Conecte seu Instagram para liberar esta métrica."
            : "Aguardando dados do Instagram.",
      empty: !connected,
    },
    {
      key: "stories",
      label: "Stories",
      icon: CircleDashed,
      // `collected` é o literal `false` no tipo — enquanto a coleta não existir,
      // este card NÃO pode exibir número algum.
      value: "—",
      hint: "Aguardando dados do Instagram.",
      empty: !connected,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Primeira linha — 6 métricas na ordem prioritária */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        {rowCards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.label}
            icon={card.icon}
            value={card.value}
            hint={card.hint}
            empty={card.empty}
            emptyMessage={
              card.emptyMessage ?? "Conecte sua rede social para liberar esta métrica."
            }
          />
        ))}
      </div>

      {/* Ressalvas honestas sobre o que a coleta atual entrega e o que não entrega. */}
      {(connected || media.reels.count != null) && (
        <div className="rounded-[16px] bg-surface/40 border border-border-soft p-4 flex gap-3 min-w-0">
          <Info size={16} className="text-ink-muted flex-none mt-0.5" />
          <div className="min-w-0 text-[12.5px] text-ink-soft flex flex-col gap-1">
            <p className="break-words">{media.reels.note}</p>
            <p className="break-words">{media.stories.note}</p>
            <p className="break-words">
              <b>Alcance 7d</b> soma os alcances diários registrados nos últimos 7 dias — não é
              uma contagem única de pessoas, porque a API devolve o alcance por dia.
            </p>
          </div>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold text-ink">
              Métricas rápidas
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5 break-words">
              {connected
                ? "Crescimento e movimentação de seguidores."
                : "Conecte seu Instagram para ver seu crescimento."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <ComparisonTile
            label="Crescimento semanal"
            icon={TrendingUp}
            value={pct(comparison.weeklyGrowth)}
            tone={tone(comparison.weeklyGrowth)}
          />
          <ComparisonTile
            label="Crescimento mensal"
            icon={TrendingUp}
            value={pct(comparison.monthlyGrowth)}
            tone={tone(comparison.monthlyGrowth)}
          />
          <ComparisonTile
            label="Ganhos (7 dias)"
            icon={TrendingUp}
            value={signedCompact(comparison.followersGrossGained7d)}
            tone={comparison.followersGrossGained7d == null ? "neutral" : "success"}
          />
          <ComparisonTile
            label="Perdas (7 dias)"
            icon={TrendingDown}
            value={
              comparison.followersLost7d == null
                ? "—"
                : `-${formatCompact(comparison.followersLost7d)}`
            }
            tone={comparison.followersLost7d == null ? "neutral" : "danger"}
          />
          <ComparisonTile
            label="Saldo (7 dias)"
            icon={Users}
            value={signedCompact(comparison.followersGained7d)}
            tone={tone(comparison.followersGained7d)}
          />
          <ComparisonTile
            label="Saldo (30 dias)"
            icon={Users}
            value={signedCompact(comparison.followersGained30d)}
            tone={tone(comparison.followersGained30d)}
          />
        </div>

        {connected && data.snapshotCount < 2 && (
          <p className="mt-5 text-[12.5px] text-ink-muted">
            Ainda há um único registro de sincronização. As comparações aparecem quando
            existir um segundo registro real.
          </p>
        )}
      </div>

      {/* Insights rápidos da IA */}
      <DashboardInsights
        deterministic={insights}
        connected={connected}
        aiConfigured={aiConfigured}
      />

      {/* Sua produção — contagens reais do banco */}
      <ProductionBlock items={media.production} />

      {/* Timeline — melhores dias */}
      {timelineItems.length > 0 && (
        <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
          <div className="mb-5">
            <h2 className="font-display text-[17px] font-bold text-ink">
              Melhores momentos
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5 break-words">
              Destaques da sua evolução recente.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {timelineItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[16px] bg-surface/50 border border-border-soft p-4 flex items-center gap-3 min-w-0"
              >
                <span className="w-10 h-10 rounded-[12px] bg-card text-ink-muted grid place-items-center shrink-0">
                  <item.icon size={18} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink-soft truncate">
                    {item.label}
                  </div>
                  <div className="font-data font-bold text-[18px] text-ink leading-tight">
                    {item.value}
                  </div>
                  <div className="text-[11.5px] text-ink-muted">{item.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Inteligente */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold text-ink">
              Score Inteligente do Perfil
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5 break-words">
              {connected
                ? "Acompanhe sua evolução."
                : "Aguardando dados do Instagram."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex items-center justify-center rounded-[16px] bg-surface/50 border border-border-soft py-6">
            <div className="text-center">
              <div className="font-data font-bold text-[clamp(36px,5vw,52px)] leading-none tracking-tight text-ink">
                {connected ? computeScore(data, media) : "—"}
                <span className="text-ink-muted text-[.55em] font-medium">
                  /100
                </span>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mt-1">
                Score Geral
              </div>
            </div>
          </div>

          {[
            { label: "Engajamento", value: scoreComponent(data, media, "engagement"), tone: "brand" },
            { label: "Crescimento", value: scoreComponent(data, media, "growth"), tone: "green" },
            { label: "Alcance", value: scoreComponent(data, media, "reach"), tone: "blue" },
            { label: "Consistência", value: scoreComponent(data, media, "consistency"), tone: "magenta" },
          ].map((p) => (
            <div
              key={p.label}
              className="rounded-[16px] bg-card border border-border-soft p-4 flex flex-col justify-center min-w-0"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-ink-soft">
                  {p.label}
                </span>
              </div>
              <div className="font-data font-bold text-[22px] text-ink">{p.value.value}</div>
              <div className="mt-3 h-[8px] rounded-pill bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-pill transition-all duration-500 ${p.value.barClass}`}
                  style={{ width: p.value.value === "—" ? "0%" : `${p.value.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {!connected && (
          <p className="mt-5 text-[12.5px] text-ink-muted">
            Aguardando dados do Instagram para calcular seu Score.
          </p>
        )}
      </div>

      {/* Evolução */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold text-ink">
              Evolução
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5 break-words">
              {connected
                ? "Seu histórico de métricas."
                : "Conecte seu Instagram para construir seu histórico de evolução."}
            </p>
          </div>
          <Tabs tabs={EVOLUTION_TABS} activeId={tab} onChange={setTab} />
        </div>

        {/* Seletor de métrica */}
        <div className="flex flex-wrap gap-2 mb-4">
          {EVOLUTION_METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-pill border transition-all cursor-pointer ${
                metric === m.id
                  ? "bg-ink text-white border-ink"
                  : "bg-card text-ink-soft border-border-soft hover:text-ink hover:border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {connected && points.length > 0 ? (
          <EvolutionChart points={points} metric={activeMetric.id} />
        ) : (
          <div className="h-56 rounded-[16px] bg-surface/40 border border-dashed border-[#D0D4DB] flex items-center justify-center">
            <EmptyState
              icon={Activity}
              title={connected ? "Sem dados ainda" : "Aguardando conexão"}
              description={
                connected
                  ? "Sincronize seu Instagram para construir o histórico de evolução."
                  : "Conecte seu Instagram para começar a acompanhar sua evolução."
              }
              className="border-none bg-transparent"
            />
          </div>
        )}

        {connected && lastSyncAt && (
          <p className="mt-4 text-[12px] text-ink-muted">
            Última sincronização:{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(lastSyncAt))}
          </p>
        )}
      </div>
    </div>
  );
}

function ComparisonTile({
  label,
  icon: Icon,
  value,
  tone,
}: {
  label: string;
  icon: typeof TrendingUp;
  value: string;
  tone: "success" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success-soft"
      : tone === "danger"
        ? "text-danger bg-danger-soft"
        : "text-ink-muted bg-surface";
  return (
    <div className="rounded-[16px] bg-card border border-border-soft p-4 flex flex-col gap-2 min-w-0">
      <span className={`w-9 h-9 rounded-[11px] grid place-items-center ${toneClass}`}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className="text-[12.5px] font-semibold text-ink-soft break-words">{label}</div>
      <div className="font-data font-bold text-[20px] text-ink leading-none">{value}</div>
    </div>
  );
}

/** Percentual formatado, ou "—" quando não há base real de comparação. */
function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** Tom visual a partir do sinal — neutro quando o valor não existe. */
function tone(n: number | null): "success" | "danger" | "neutral" {
  if (n == null) return "neutral";
  return n >= 0 ? "success" : "danger";
}

/** Inteiro com sinal explícito, ou "—". */
function signedCompact(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : "-"}${formatCompact(Math.abs(n))}`;
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return String(n);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(iso)
  );
}

/** Score geral (0–100) — derivado apenas de dados reais; nunca inventado. */
function computeScore(data: DashboardInstagramData, media: MediaProductionData): number {
  const parts: number[] = [];
  if (data.cards.followers.value != null) parts.push(normalize01(data.cards.followers.value) * 100);
  if (media.avgInteractionsPerMedia != null)
    parts.push(clamp01(media.avgInteractionsPerMedia / 500) * 100);
  if (data.cards.reach7d.value != null) parts.push(normalize01(data.cards.reach7d.value) * 100);
  if (data.comparison.monthlyGrowth != null)
    parts.push(clamp01(data.comparison.monthlyGrowth / 50) * 100);
  if (data.snapshotCount >= 2) parts.push(70 + Math.min(data.snapshotCount * 3, 30));
  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** normaliza 0..valor em escala 0..1 com teto de 100k para seguidores. */
function normalize01(v: number): number {
  return clamp01(v / 100_000);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function scoreComponent(
  data: DashboardInstagramData,
  media: MediaProductionData,
  kind: "engagement" | "growth" | "reach" | "consistency"
): { value: number | "—"; barClass: string } {
  if (!data.connected) return { value: "—", barClass: "bg-surface" };

  const raw: number | null = (() => {
    switch (kind) {
      case "engagement":
        // Média real de interações por publicação (curtidas + comentários).
        return media.avgInteractionsPerMedia != null
          ? Math.round(clamp01(media.avgInteractionsPerMedia / 500) * 100)
          : null;
      case "growth":
        return data.comparison.monthlyGrowth != null
          ? Math.round(clamp01(data.comparison.monthlyGrowth / 50) * 100)
          : null;
      case "reach":
        return data.cards.reach7d.value != null
          ? Math.round(clamp01(data.cards.reach7d.value / 100_000) * 100)
          : null;
      case "consistency":
        return data.snapshotCount >= 2
          ? Math.min(70 + data.snapshotCount * 3, 100)
          : null;
    }
  })();

  if (raw == null) return { value: "—", barClass: "bg-surface" };

  const barClass = raw >= 60 ? "bg-success" : raw >= 30 ? "bg-warn" : "bg-danger";
  return { value: raw, barClass };
}
