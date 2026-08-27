"use client";

import * as React from "react";
import {
  BrainCircuit,
  RefreshCw,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

interface Pillar {
  key: string;
  label: string;
  value: number | null;
  available: boolean;
  weight?: number;
  complementary?: boolean;
}

interface ScoreResult {
  platform: string;
  overall: number | null;
  pillars: Pillar[];
  factors: { positive: string[]; attention: string[]; unavailable: string[] };
  version: string | number;
  source: string;
  coverage?: number | null;
  weighting?: { engagement: number; growth: number; reach: number; consistency: number };
}

interface HistoryItem {
  id: string;
  overall: number;
  createdAt: string;
}

interface DiagnosticItem {
  category: string;
  label: string;
  state: string;
  detail: string;
}

const STATE_META: Record<string, { label: string; cls: string; icon: "up" | "alert" | "info" | "ok" | "x" }> = {
  "ponto-forte": { label: "Ponto forte", cls: "bg-success/10 text-success", icon: "up" },
  oportunidade: { label: "Oportunidade", cls: "bg-info/10 text-info", icon: "info" },
  atencao: { label: "Atenção", cls: "bg-warn/10 text-warn", icon: "alert" },
  "ponto-fraco": { label: "Ponto fraco", cls: "bg-danger-soft text-danger", icon: "x" },
  "dados-insuficientes": { label: "Dados insuficientes", cls: "bg-surface text-ink-muted", icon: "info" },
};

function StateIcon({ icon }: { icon: "up" | "alert" | "info" | "ok" | "x" }) {
  if (icon === "up") return <TrendingUp size={14} />;
  if (icon === "alert") return <AlertTriangle size={14} />;
  if (icon === "x") return <XCircle size={14} />;
  if (icon === "ok") return <CheckCircle2 size={14} />;
  return <Info size={14} />;
}

interface ScoreClientProps {
  initial: {
    instagram: { score: ScoreResult; history: HistoryItem[]; diagnosis: DiagnosticItem[] };
    tiktok: { score: ScoreResult; history: HistoryItem[]; diagnosis: DiagnosticItem[] };
  } | null;
}

export function ScoreClient({ initial }: ScoreClientProps) {
  const { toast } = useToast();

  const [platform, setPlatform] = React.useState<string>("instagram");
  const [score, setScore] = React.useState<ScoreResult | null>(initial?.instagram?.score ?? null);
  const [history, setHistory] = React.useState<HistoryItem[]>(initial?.instagram?.history ?? []);
  const [diagnosis, setDiagnosis] = React.useState<DiagnosticItem[]>(initial?.instagram?.diagnosis ?? []);
  const [loading, setLoading] = React.useState(false);
  const [persisting, setPersisting] = React.useState(false);

  async function load(p: string) {
    setLoading(true);
    setPlatform(p);
    try {
      const cached = initial
        ? (initial as unknown as Record<string, { score: ScoreResult; history: HistoryItem[]; diagnosis: DiagnosticItem[] }>)[p]
        : null;
      if (cached) {
        setScore(cached.score);
        setHistory(cached.history);
        setDiagnosis(cached.diagnosis);
        return;
      }
      const [scoreRes, diagRes] = await Promise.all([
        fetch(`/api/score?platform=${encodeURIComponent(p)}`),
        fetch(`/api/diagnostico?platform=${encodeURIComponent(p)}`),
      ]);
      const scoreData = await scoreRes.json();
      const diagData = await diagRes.json();
      if (!scoreRes.ok || !diagRes.ok) {
        toast(scoreData.error ?? diagData.error ?? "Erro ao carregar.", "error");
        return;
      }
      setScore(scoreData.score);
      setHistory(scoreData.history);
      setDiagnosis(diagData.items);
    } catch {
      toast("Não foi possível carregar o Score.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function persist() {
    setPersisting(true);
    try {
      const res = await fetch(`/api/score?platform=${encodeURIComponent(platform)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao salvar.", "error");
        return;
      }
      setScore(data.score);
      if (data.persisted) {
        const item: HistoryItem = {
          id: `h-${Date.now()}`,
          overall: data.score?.overall ?? 0,
          createdAt: new Date().toISOString(),
        };
        setHistory((prev) => [item, ...prev]);
        toast("Score registrado no histórico!");
      } else {
        toast("Sem dados suficientes para registrar o Score.");
      }
    } catch {
      toast("Não foi possível salvar.", "error");
    } finally {
      setPersisting(false);
    }
  }

  const isConnected =
    score != null && (score.pillars.some((p) => p.available) || (score.overall ?? null) != null);

  return (
    <div className="flex flex-col gap-5">
      {/* Seletor de plataforma */}
      <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
        <label className="text-[12.5px] font-semibold text-ink-soft">Plataforma</label>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => load(p.id)}
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

      {loading && (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-10 grid place-items-center">
          <Loader2 size={24} className="animate-spin text-purple" />
        </div>
      )}

      {!loading && !isConnected && (
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-6">
          <EmptyState
            icon={BrainCircuit}
            title="Sem dados suficientes"
            description="Conecte e sincronize sua rede social para calcular o Score Inteligente. Quando não há dados, nada é estimado — nunca usamos 0 para 'indisponível'."
          />
        </div>
      )}

      {!loading && isConnected && score && (
        <>
          {/* Score geral + pilares */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5">
            <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6 flex flex-col items-center justify-center gap-2">
              <CircularProgress
                value={score.overall ?? 0}
                size={176}
                label="Score Geral"
                sublabel={
                  score.overall == null
                    ? "Indisponível"
                    : `${score.overall >= 70 ? "Bom" : score.overall >= 40 ? "Em desenvolvimento" : "Precisa de atenção"}`
                }
              />
              <Button variant="outline" size="sm" onClick={persist} disabled={persisting} className="gap-2">
                {persisting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Registrar no histórico
              </Button>
              {score.coverage != null && (
                <span className="text-[11.5px] text-ink-muted text-center">
                  Cobertura dos dados: {score.coverage}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {score.pillars.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "rounded-[14px] bg-card border border-border-soft shadow-xs p-4 flex flex-col gap-1.5",
                    !p.available && "opacity-70"
                  )}
                >
                  <span className="text-[12px] font-semibold text-ink-soft">{p.label}</span>
                  <span className="font-display text-[24px] font-bold text-ink">
                    {p.available ? p.value : "—"}
                  </span>
                  {p.available ? (
                    <span
                      className={cn(
                        "text-[11.5px] font-bold",
                        (p.value ?? 0) >= 70
                          ? "text-success"
                          : (p.value ?? 0) <= 35
                            ? "text-danger"
                            : "text-warn"
                      )}
                    >
                      {(p.value ?? 0) >= 70
                        ? "Bom"
                        : (p.value ?? 0) <= 35
                          ? "Atenção"
                          : "Em desenvolvimento"}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-ink-muted">Sem dados</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fatores */}
          {(score.factors.positive.length > 0 ||
            score.factors.attention.length > 0 ||
            score.factors.unavailable.length > 0) && (
            <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
              <h3 className="font-display text-[15.5px] font-bold text-ink">Fatores</h3>

              {score.factors.positive.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-success">Pontos fortes</span>
                  <div className="flex flex-wrap gap-2">
                    {score.factors.positive.map((f, i) => (
                      <span key={i} className="text-[12.5px] font-medium text-ink-soft bg-success/5 border border-success/20 rounded-pill px-3 py-1">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {score.factors.attention.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-warn">Atenção</span>
                  <div className="flex flex-wrap gap-2">
                    {score.factors.attention.map((f, i) => (
                      <span key={i} className="text-[12.5px] font-medium text-ink-soft bg-warn/5 border border-warn/20 rounded-pill px-3 py-1">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {score.factors.unavailable.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-ink-muted">Indisponíveis</span>
                  <div className="flex flex-wrap gap-2">
                    {score.factors.unavailable.map((f, i) => (
                      <span key={i} className="text-[12.5px] text-ink-muted bg-surface border border-border-soft rounded-pill px-3 py-1">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[12px] text-ink-muted mt-1">
                Fórmula: {score.version}
                {score.coverage != null ? ` · cobertura: ${score.coverage}%` : ""} · fonte: {score.source}
              </p>
            </div>
          )}

          {/* Diagnóstico */}
          <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
            <h3 className="font-display text-[15.5px] font-bold text-ink">
              Diagnóstico automático
            </h3>
            {diagnosis.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Sem dados suficientes para diagnosticar.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {diagnosis.map((d, i) => {
                  const meta = STATE_META[d.state] ?? STATE_META["dados-insuficientes"];
                  return (
                    <div key={i} className="rounded-[12px] bg-bg-ice border border-border-soft p-4 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-ink">{d.label}</span>
                        <span className={cn("text-[11px] font-bold rounded-pill px-2 py-0.5 flex items-center gap-1", meta.cls)}>
                          <StateIcon icon={meta.icon} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-soft leading-snug">{d.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico */}
          {history.length > 0 && (
            <div className="rounded-[14px] bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
              <h3 className="font-display text-[15.5px] font-bold text-ink">Histórico</h3>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 14).map((h) => (
                  <div key={h.id} className="rounded-[12px] bg-bg-ice border border-border-soft px-3 py-2 flex flex-col items-center">
                    <span className="font-display text-[16px] font-bold text-ink">{h.overall}</span>
                    <span className="text-[10.5px] text-ink-muted">
                      {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(h.createdAt))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
