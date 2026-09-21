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
  Heart,
  Eye,
  CalendarCheck,
  CalendarDays,
  Activity,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CircularProgress } from "@/components/ui/circular-progress";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import {
  pillarGuidance,
  pillarWeightLabel,
  sortPillarsForDisplay,
  type PillarBand,
} from "@/lib/ai/services/score-guidance";

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
  /** Quantos pilares oficiais têm evidência real. */
  measuredPillars?: number;
  totalPillars?: number;
  /** false → o Score Geral não é publicado (evidência insuficiente). */
  scoreAvailable?: boolean;
  /** Motivo legível quando o Score Geral não é publicado. */
  reason?: string | null;
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

/** Ícone de cada pilar do Score. Pilar desconhecido → ícone neutro. */
function pillarIcon(key: string) {
  if (key === "engagement") return Heart;
  if (key === "growth") return TrendingUp;
  if (key === "reach") return Eye;
  if (key === "consistency") return CalendarCheck;
  if (key === "frequency") return CalendarDays;
  if (key === "content") return BarChart3;
  return Activity;
}

/** Cor por faixa medida — as mesmas três faixas usadas no resto da tela. */
function bandColor(band: PillarBand): string {
  if (band === "bom") return "text-success";
  if (band === "atencao") return "text-danger";
  if (band === "desenvolvimento") return "text-warn";
  return "text-ink-muted";
}

/**
 * Card de UM pilar do Score.
 *
 * Mostra SEMPRE, para o mesmo pilar: ícone, anel com a nota, rótulo, status,
 * barra de progresso e recomendação. Quando não há dado, nenhum desses
 * elementos é preenchido com zero — o anel fica tracejado, a barra não é
 * desenhada e a recomendação é a de COLETAR o dado (ver `score-guidance`).
 */
function PillarCard({ pillar }: { pillar: Pillar }) {
  const g = pillarGuidance(
    pillar.key,
    pillar.value,
    pillar.available,
    Boolean(pillar.complementary)
  );
  const measured = g.band !== "indisponivel";
  const Icon = pillarIcon(pillar.key);
  const weightLabel = pillarWeightLabel(pillar.weight ?? 0, Boolean(pillar.complementary));

  return (
    <div
      className={cn(
        "rounded-[14px] bg-card border border-border-soft shadow-xs p-4 flex flex-col gap-3 min-w-0"
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            "w-8 h-8 rounded-[10px] grid place-items-center flex-none border",
            measured ? "bg-ai-soft text-purple border-purple/15" : "bg-surface text-ink-muted border-border-soft"
          )}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>

        <div className="flex-1 min-w-0">
          {/* O rótulo do pilar pode ser uma palavra longa; `break-words` evita
              que ele empurre a coluna em telas de 320px. */}
          <p className="text-[12.5px] font-semibold text-ink break-words">{pillar.label}</p>
          <span className={cn("text-[11.5px] font-bold", bandColor(g.band))}>{g.statusLabel}</span>
          {weightLabel && (
            <p className="text-[10.5px] text-ink-muted mt-0.5">{weightLabel}</p>
          )}
        </div>

        <div className="flex-none relative w-[58px] h-[58px]">
          {measured ? (
            <>
              {/* O anel do componente não exibe o número aqui: nesta altura
                  (58px) a fonte seria maior que o círculo. O valor entra em
                  um overlay próprio, com tamanho fixo. */}
              <CircularProgress
                value={pillar.value ?? 0}
                size={58}
                strokeWidth={6}
                showValue={false}
                gradientId={`ringGrad-${pillar.key}`}
              />
              <span className="absolute inset-0 grid place-items-center font-data font-bold text-[16px] leading-none text-ink">
                {Math.round(pillar.value ?? 0)}
              </span>
            </>
          ) : (
            <div
              className="w-[58px] h-[58px] rounded-full border-[5px] border-dashed border-border grid place-items-center"
              aria-label="Sem dado para este pilar"
            >
              <span className="text-[14px] font-bold text-ink-muted">—</span>
            </div>
          )}
        </div>
      </div>

      {/* Barra de progresso: só quando existe nota. Sem dado não há o que
          preencher, e uma barra vazia afirmaria desempenho zero. */}
      {measured && (
        <ProgressBar
          value={pillar.value ?? 0}
          gradient={g.band === "bom" ? "green" : g.band === "atencao" ? "magenta" : "blue"}
        />
      )}

      <p className="text-[12px] text-ink-soft leading-relaxed">{g.recommendation}</p>
    </div>
  );
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
      // `persisted` só é true quando o servidor conseguiu gravar. Um Score
      // Geral nulo NUNCA entra no histórico — nada é fabricado aqui.
      if (data.persisted && data.score?.overall != null) {
        const item: HistoryItem = {
          id: `h-${Date.now()}`,
          overall: data.score.overall,
          createdAt: new Date().toISOString(),
        };
        setHistory((prev) => [item, ...prev]);
        toast("Score registrado no histórico!");
      } else {
        toast(
          data.score?.reason ??
            "Score ainda não disponível: sem evidência suficiente para uma avaliação confiável.",
          "error"
        );
      }
    } catch {
      toast("Não foi possível salvar.", "error");
    } finally {
      setPersisting(false);
    }
  }

  const isConnected =
    score != null && (score.pillars.some((p) => p.available) || (score.overall ?? null) != null);

  // Score publicado? `scoreAvailable` é explícito; o fallback cobre payloads
  // antigos (sem o campo) para não esconder um Score que já era válido.
  const scoreAvailable =
    score != null && (score.scoreAvailable ?? (score.overall ?? null) != null);
  const canPersist = scoreAvailable;
  const measured = score?.measuredPillars ?? score?.pillars.filter((p) => p.available).length ?? 0;

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
              {scoreAvailable ? (
                <CircularProgress
                  value={score.overall ?? 0}
                  size={176}
                  label="Score Geral"
                  sublabel={`${(score.overall ?? 0) >= 70 ? "Bom" : (score.overall ?? 0) >= 40 ? "Em desenvolvimento" : "Precisa de atenção"}`}
                />
              ) : (
                /* Sem evidência mínima NÃO existe nota. Mostrar um anel vazio
                   com "0" seria afirmar desempenho péssimo a partir de ausência. */
                <div className="w-[176px] h-[176px] rounded-full border-[10px] border-dashed border-border grid place-items-center text-center px-6">
                  <div>
                    <div className="font-display text-[15px] font-bold text-ink leading-tight">
                      Score ainda não disponível
                    </div>
                    <div className="text-[11.5px] text-ink-muted mt-1">
                      Evidência insuficiente
                    </div>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={persist}
                disabled={persisting || !canPersist}
                className="gap-2"
                title={
                  canPersist
                    ? undefined
                    : "Registre quando houver evidência suficiente para uma avaliação confiável."
                }
              >
                {persisting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Registrar no histórico
              </Button>
              {score.coverage != null && (
                <span className="text-[11.5px] text-ink-muted text-center">
                  Cobertura dos dados: {score.coverage}%
                  {score.totalPillars
                    ? ` · ${measured} de ${score.totalPillars} pilares com dados`
                    : ""}
                </span>
              )}
              {!canPersist && score.reason && (
                <span className="text-[11.5px] text-ink-muted text-center max-w-[30ch] leading-snug">
                  {score.reason}
                </span>
              )}
            </div>

            {/* PILARES — grade 2×2 no desktop (Engajamento, Crescimento,
                Alcance, Consistência), cada um com ícone, anel de nota,
                status, barra de progresso real e recomendação.
                O rodapé da grade só existe quando há pilar complementar
                (Frequência/Desempenho), que vem depois dos 4 oficiais. */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortPillarsForDisplay(score.pillars)
                  .filter((p) => !p.complementary)
                  .map((p) => (
                    <PillarCard key={p.key} pillar={p} />
                  ))}
              </div>

              {sortPillarsForDisplay(score.pillars).some((p) => p.complementary) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortPillarsForDisplay(score.pillars)
                    .filter((p) => p.complementary)
                    .map((p) => (
                      <PillarCard key={p.key} pillar={p} />
                    ))}
                </div>
              )}
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
