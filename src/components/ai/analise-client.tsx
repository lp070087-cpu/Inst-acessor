"use client";

import * as React from "react";
import { BarChart3, Loader2, TrendingUp, TrendingDown, Trophy, Minus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

const PERIODS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
] as const;

interface Metric {
  key: string;
  label: string;
  value: number | null;
  changePercent: number | null;
  available: boolean;
}

interface BestItem {
  label: string;
  date: string;
  value: number;
}

interface EvolutionPoint {
  label: string;
  capturedAt: string;
  followersCount?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  mediaCount?: number | null;
  videoCount?: number | null;
  likesCount?: number | null;
}

interface AnalysisResult {
  platform: string;
  connected: boolean;
  username?: string | null;
  snapshotCount: number;
  lastSyncAt?: string | null;
  metrics: Metric[];
  bestItems: BestItem[];
  evolution: EvolutionPoint[];
  periods: string[];
}

interface AnaliseClientProps {
  initialData: {
    instagram: AnalysisResult;
    tiktok: AnalysisResult;
  } | null;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export function AnaliseClient({ initialData }: AnaliseClientProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [period, setPeriod] = React.useState<string>("30d");
  const [data, setData] = React.useState<AnalysisResult | null>(
    initialData ? (initialData as Record<string, AnalysisResult>)[platform] ?? null : null
  );
  const [loading, setLoading] = React.useState(false);

  async function load(p: string, per: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/analise?platform=${encodeURIComponent(p)}&period=${encodeURIComponent(per)}`);
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Erro ao carregar análise.", "error");
        return;
      }
      setData(json);
    } catch {
      toast("Não foi possível carregar a análise.", "error");
    } finally {
      setLoading(false);
    }
  }

  function changePlatform(p: string) {
    setPlatform(p);
    if (initialData) {
      const cached = (initialData as unknown as Record<string, AnalysisResult>)[p];
      if (cached) {
        setData(cached);
        return;
      }
    }
    load(p, period);
  }

  function changePeriod(per: string) {
    setPeriod(per);
    load(platform, per);
  }

  const evolutionPoints = data?.evolution ?? [];
  const bestItems = data?.bestItems ?? [];
  const metrics = data?.metrics ?? [];
  const connected = data?.connected ?? false;

  // Dados do gráfico de evolução (segunda métrica quando disponível)
  const seriesLabel = platform === "instagram" ? "Seguidores" : "Seguidores";
  const series = evolutionPoints.map((p) => p.followersCount ?? null);
  const series2 = evolutionPoints.map((p) =>
    platform === "instagram" ? (p.reach ?? null) : (p.likesCount ?? null)
  );
  const maxVal = Math.max(
    ...series.filter((v): v is number => v != null),
    ...series2.filter((v): v is number => v != null),
    1
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-ink-soft">Plataforma</label>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => changePlatform(p.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                    platform === p.id
                      ? "bg-ai-soft border-purple/40 text-purple"
                      : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-ink-soft">Período</label>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => changePeriod(p.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-pill border text-[13px] font-semibold transition-all cursor-pointer",
                    period === p.id
                      ? "bg-purple text-white border-purple"
                      : "bg-bg-ice border-border text-ink-soft hover:text-ink"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-10 grid place-items-center">
          <Loader2 size={24} className="animate-spin text-purple" />
        </div>
      )}

      {!loading && !connected && (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={BarChart3}
            title="Perfil não conectado"
            description={`Conecte sua conta do ${platform === "instagram" ? "Instagram" : "TikTok"} e sincronize os dados para ver a análise. Nada é inventado enquanto isso.`}
          />
        </div>
      )}

      {!loading && connected && (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.key}
                className="rounded-[14px] bg-card border border-border-soft shadow-xs p-4 flex flex-col gap-1.5"
              >
                <span className="text-[12px] font-semibold text-ink-soft">{m.label}</span>
                <span className="font-display text-[22px] font-bold text-ink">
                  {fmt(m.value)}
                  {m.key === "growth" && m.value != null && "%"}
                </span>
                <span className="flex items-center gap-1">
                  {m.changePercent != null ? (
                    <>
                      {m.changePercent >= 0 ? (
                        <TrendingUp size={14} className="text-success" />
                      ) : (
                        <TrendingDown size={14} className="text-danger" />
                      )}
                      <span
                        className={cn(
                          "text-[12px] font-bold",
                          m.changePercent >= 0 ? "text-success" : "text-danger"
                        )}
                      >
                        {m.changePercent >= 0 ? "+" : ""}
                        {m.changePercent.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <Minus size={14} className="text-ink-muted" />
                  )}
                  <span className="text-[11px] text-ink-muted">vs. anterior</span>
                </span>
              </div>
            ))}
          </div>

          {/* Evolução */}
          {evolutionPoints.length >= 2 && (
            <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6">
              <h3 className="font-display text-[15.5px] font-bold text-ink mb-4">
                Evolução · {PERIODS.find((p) => p.id === period)?.label}
              </h3>
              <div className="flex flex-col gap-2">
                {evolutionPoints.map((p, i) => {
                  const v = p.followersCount ?? null;
                  const v2 = platform === "instagram" ? (p.reach ?? null) : (p.likesCount ?? null);
                  const h = v != null ? Math.max((v / maxVal) * 100, 2) : 0;
                  const h2 = v2 != null ? Math.max((v2 / maxVal) * 100, 2) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 flex-none text-[11px] text-ink-muted text-right">
                        {p.label}
                      </span>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="h-2.5 rounded-pill bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-pill bg-brand-grad transition-all"
                            style={{ width: `${h}%` }}
                          />
                        </div>
                        {v2 != null && (
                          <div className="h-1.5 rounded-pill bg-surface overflow-hidden">
                            <div
                              className="h-full rounded-pill bg-purple/50 transition-all"
                              style={{ width: `${h2}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <span className="w-14 flex-none text-[11px] font-semibold text-ink text-left">
                        {fmt(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[12px] text-ink-muted mt-4">
                Barras: {seriesLabel}. Linha adicional (quando houver):{" "}
                {platform === "instagram" ? "Alcance" : "Curtidas"}.
              </p>
            </div>
          )}

          {/* Melhores momentos */}
          {bestItems.length > 0 && (
            <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6">
              <h3 className="font-display text-[15.5px] font-bold text-ink mb-4">
                Melhores momentos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bestItems.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-[12px] bg-bg-ice border border-border-soft p-4 flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy size={15} className="text-warn" />
                      <span className="text-[12.5px] font-semibold text-ink-soft">{b.label}</span>
                    </div>
                    <span className="font-display text-[20px] font-bold text-ink">
                      {fmt(b.value)}
                    </span>
                    <span className="text-[12px] text-ink-muted">{formatDate(b.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé informativo */}
          <p className="text-[12.5px] text-ink-muted px-1">
            {data?.username ? `Perfil: @${data.username} · ` : ""}
            {data?.snapshotCount ?? 0} sincronização(ões) ·{" "}
            {data?.lastSyncAt
              ? `última em ${formatDate(data.lastSyncAt)}`
              : "sem sincronização recente"}
          </p>
        </>
      )}
    </div>
  );
}
