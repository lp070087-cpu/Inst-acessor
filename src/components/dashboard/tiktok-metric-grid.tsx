"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Heart,
  Clapperboard,
  TrendingUp,
  Award,
  Activity,
} from "lucide-react";

import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { EvolutionChart } from "@/components/dashboard/evolution-chart";
import type { TikTokDashboardData } from "@/lib/dashboard/tiktok-data";

const EVOLUTION_TABS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];

const EVOLUTION_METRICS: {
  id: "followersCount" | "videoCount" | "likesCount";
  label: string;
}[] = [
  { id: "followersCount", label: "Seguidores" },
  { id: "videoCount", label: "Vídeos" },
  { id: "likesCount", label: "Curtidas" },
];

/**
 * Métricas do TikTok — alimentado por dados REAIS (server component).
 * Nunca inventa números: valor/variação só aparecem quando disponíveis.
 */
export function TikTokMetricGrid({ data }: { data: TikTokDashboardData }) {
  const { connected, cards, evolution, comparison, timeline, lastSyncAt } = data;
  const [tab, setTab] = useState("7d");
  const [metric, setMetric] = useState<(typeof EVOLUTION_METRICS)[number]["id"]>(
    "followersCount"
  );

  const period = (tab as "7d" | "30d" | "90d") in evolution ? (tab as "7d" | "30d" | "90d") : "7d";
  const activeMetric = EVOLUTION_METRICS.find((m) => m.id === metric) ?? EVOLUTION_METRICS[0];
  const points = evolution[period] ?? [];

  // Cards: ícone por métrica, variação quando houver
  const cardConfigs = [
    { label: "Seguidores", icon: Users, card: cards.followers },
    { label: "Seguindo", icon: UserPlus, card: cards.following },
    { label: "Curtidas", icon: Heart, card: cards.likes },
    { label: "Vídeos", icon: Clapperboard, card: cards.videos },
  ];

  // Timeline (melhores dias) — calculado server-side, exibido aqui
  type TimelineItem = {
    label: string;
    icon: typeof TrendingUp;
    value: string;
    date: string;
  };
  const timelineItems: TimelineItem[] = [];
  if (timeline.biggestFollowerPeak) {
    timelineItems.push({
      label: "Pico de seguidores",
      icon: Award,
      value: formatCompact(timeline.biggestFollowerPeak.value),
      date: formatDate(timeline.biggestFollowerPeak.date),
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
  if (timeline.biggestDailyLoss) {
    timelineItems.push({
      label: "Maior queda de seguidores",
      icon: TrendingUp,
      value: `${formatCompact(timeline.biggestDailyLoss.value)}`,
      date: formatDate(timeline.biggestDailyLoss.date),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cardConfigs.map(({ label, icon, card }) => (
          <MetricCard
            key={label}
            label={label}
            icon={icon}
            value={card.available ? formatCompact(card.value) : "—"}
            hint={
              card.changePercent != null
                ? `${card.changePercent >= 0 ? "+" : ""}${card.changePercent.toFixed(1)}% desde o último sync`
                : !connected
                  ? "Conecte seu TikTok para liberar esta métrica."
                  : "Aguardando dados do TikTok."
            }
            empty={!connected}
            emptyMessage="Conecte seu TikTok para liberar esta métrica."
          />
        ))}
      </div>

      {/* Comparação de períodos */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-display text-[17px] font-bold text-ink">
              Comparação de períodos
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5">
              {connected
                ? "Seu crescimento entre períodos."
                : "Conecte seu TikTok para ver seu crescimento."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ComparisonTile
            label="Crescimento semanal"
            icon={TrendingUp}
            value={comparison.weeklyGrowth != null ? `${comparison.weeklyGrowth >= 0 ? "+" : ""}${comparison.weeklyGrowth.toFixed(1)}%` : "—"}
            tone={comparison.weeklyGrowth == null ? "neutral" : comparison.weeklyGrowth >= 0 ? "success" : "danger"}
          />
          <ComparisonTile
            label="Crescimento mensal"
            icon={TrendingUp}
            value={comparison.monthlyGrowth != null ? `${comparison.monthlyGrowth >= 0 ? "+" : ""}${comparison.monthlyGrowth.toFixed(1)}%` : "—"}
            tone={comparison.monthlyGrowth == null ? "neutral" : comparison.monthlyGrowth >= 0 ? "success" : "danger"}
          />
          <ComparisonTile
            label="Seguidores (7d)"
            icon={Users}
            value={comparison.followersGained7d != null ? `${comparison.followersGained7d >= 0 ? "+" : ""}${formatCompact(comparison.followersGained7d)}` : "—"}
            tone={comparison.followersGained7d == null ? "neutral" : comparison.followersGained7d >= 0 ? "success" : "danger"}
          />
          <ComparisonTile
            label="Seguidores (30d)"
            icon={Users}
            value={comparison.followersGained30d != null ? `${comparison.followersGained30d >= 0 ? "+" : ""}${formatCompact(comparison.followersGained30d)}` : "—"}
            tone={comparison.followersGained30d == null ? "neutral" : comparison.followersGained30d >= 0 ? "success" : "danger"}
          />
        </div>
      </div>

      {/* Timeline — melhores dias */}
      {timelineItems.length > 0 && (
        <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
          <div className="mb-5">
            <h2 className="font-display text-[17px] font-bold text-ink">
              Melhores momentos
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5">
              Destaques da sua evolução recente.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {timelineItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[16px] bg-surface/50 border border-border-soft p-4 flex items-center gap-3"
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

      {/* Evolução */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-display text-[17px] font-bold text-ink">
              Evolução
            </h2>
            <p className="text-[13px] text-ink-soft mt-0.5">
              {connected
                ? "Seu histórico de métricas."
                : "Conecte seu TikTok para construir seu histórico de evolução."}
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
                  ? "Sincronize seu TikTok para construir o histórico de evolução."
                  : "Conecte seu TikTok para começar a acompanhar sua evolução."
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
    <div className="rounded-[16px] bg-card border border-border-soft p-4 flex flex-col gap-2">
      <span className={`w-9 h-9 rounded-[11px] grid place-items-center ${toneClass}`}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className="text-[12.5px] font-semibold text-ink-soft">{label}</div>
      <div className="font-data font-bold text-[20px] text-ink leading-none">{value}</div>
    </div>
  );
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
