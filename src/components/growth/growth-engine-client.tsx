"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Zap,
  Target,
  Calendar,
  CalendarRange,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  Bot,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type {
  DailyMission,
  DayPlan,
  GrowthActionView,
  GrowthContext,
  GrowthPlan30Days,
  GrowthPlan7Days,
  GrowthPriority,
  GrowthRecommendation,
  GrowthSignal,
} from "@/lib/growth-engine";
import type { ProactiveInsight } from "@/lib/growth-engine/insights";
import type { InternalAutomation } from "@/lib/growth-engine/automations";
import type { LucideIcon } from "lucide-react";

// Tipagem explícita dos planos (evita implicit any nos maps).
type Plan7 = GrowthPlan7Days;
type Plan30 = GrowthPlan30Days;

interface EnginePayload {
  context: GrowthContext;
  signals: GrowthSignal[];
  priorities: GrowthPriority[];
  recommendations: GrowthRecommendation[];
  actions: GrowthActionView[];
  mission: DailyMission | null;
  plan7: Plan7;
  plan30: Plan30;
  insights: ProactiveInsight[];
  automations: InternalAutomation[];
  changes: string[];
  confidence: number;
  insufficientData: boolean;
}

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "success" | "neutral"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "success",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "Prioridade 1",
  2: "Prioridade 2",
  3: "Prioridade 3",
};

export function GrowthEngineClient({ initial }: { initial: EnginePayload | null }) {
  const { toast } = useToast();
  const [data, setData] = useState<EnginePayload | null>(initial);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/growth/engine", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar motor");
      const json = await res.json();
      setData(json);
      toast("Motor atualizado", "success");
    } catch {
      toast("Não foi possível atualizar o motor", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!initial) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateAction = useCallback(
    async (id: string, status: string) => {
      try {
        const res = await fetch(`/api/growth/actions?id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Falha ao atualizar ação");
        const json = await res.json();
        if (status === "COMPLETED" && json.xp) {
          toast(`Ação concluída! +${json.xp.amount} XP`, "success");
        } else {
          toast("Ação atualizada", "success");
        }
        await refresh();
      } catch {
        toast("Falha ao atualizar ação", "error");
      }
    },
    [refresh, toast]
  );

  if (!data) {
    return (
      <EmptyState
        icon={Zap as LucideIcon}
        title="Motor de crescimento"
        description="Conecte uma rede social para começar a receber recomendações inteligentes."
      />
    );
  }

  const { mission, priorities, recommendations, actions, plan7, plan30, insights, automations, changes } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Header actions */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Atualizando…" : "Atualizar motor"}
        </Button>
      </div>

      {/* Missão do dia */}
      {mission?.action ? (
        <div className="rounded-2xl bg-surface/80 border border-soft p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-purple font-semibold text-[13px] uppercase tracking-wide">
            <Target size={16} />
            Missão do dia
          </div>
          <p className="text-[15px] font-semibold text-ink">{mission.action.title}</p>
          <p className="text-[13px] text-ink-soft">{mission.rationale}</p>
          <div className="flex gap-2 mt-1">
            <Badge tone={mission.action.status === "PENDING" ? "info" : "warning"}>
              {mission.action.status}
            </Badge>
            {mission.action.priority && (
              <Badge tone="neutral">{PRIORITY_LABEL[mission.action.priority]}</Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface/80 border border-soft p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-purple font-semibold text-[13px] uppercase tracking-wide">
            <Target size={16} />
            Missão do dia
          </div>
          <p className="text-[13.5px] text-ink-soft">{mission?.rationale ?? "DADO INSUFICIENTE"}</p>
        </div>
      )}

      {/* Prioridades */}
      {priorities.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <Zap size={15} className="text-purple" />
            Prioridades
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {priorities.map((p) => (
              <div key={p.level} className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-2">
                <Badge tone={p.level === 1 ? "danger" : p.level === 2 ? "warning" : "info"}>
                  {PRIORITY_LABEL[p.level]}
                </Badge>
                <p className="text-[13.5px] font-semibold text-ink">{p.title}</p>
                <p className="text-[12px] text-ink-soft">{p.evidenceSummary}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge tone="neutral" size="xs">Impacto {Math.round(p.impact * 100)}%</Badge>
                  <Badge tone="neutral" size="xs">Urgência {Math.round(p.urgency * 100)}%</Badge>
                  <Badge tone="neutral" size="xs">Confiança {Math.round(p.confidence * 100)}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sinais importantes */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <AlertTriangle size={15} className="text-purple" />
            Sinais importantes
          </h3>
          <div className="flex flex-col gap-2">
            {insights.slice(0, 5).map((ins) => (
              <div key={ins.id} className="rounded-xl bg-white border border-soft px-4 py-3 flex items-start gap-3">
                <Badge tone={SEVERITY_TONE[ins.severity] ?? "neutral"} size="sm">
                  {ins.severity}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-ink">{ins.title}</p>
                  <p className="text-[12px] text-ink-soft">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automações internas */}
      {automations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <Bot size={15} className="text-purple" />
            Automações internas
          </h3>
          <div className="flex flex-col gap-2">
            {automations.map((a) => (
              <div key={a.id} className="rounded-xl bg-white border border-soft px-4 py-3 flex items-start gap-3">
                <Badge tone={SEVERITY_TONE[a.severity] ?? "neutral"} size="sm">
                  {a.output === "alerta" ? "Alerta" : a.output === "recomendacao" ? "Recomendação" : "Ação"}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                  <p className="text-[12px] text-ink-soft">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">
            Nenhuma DM real, publicação automática ou resposta a comentários é realizada.
          </p>
        </div>
      )}

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <Lightbulb size={15} className="text-purple" />
            Recomendações acionáveis
          </h3>
          <div className="flex flex-col gap-3">
            {recommendations.map((rec) => (
              <div key={rec.slug} className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[14px] font-semibold text-ink">{rec.oQue}</p>
                  <Badge tone={rec.priorityLevel === 1 ? "danger" : rec.priorityLevel === 2 ? "warning" : "info"}>
                    {PRIORITY_LABEL[rec.priorityLevel]}
                  </Badge>
                </div>
                <p className="text-[12.5px] text-ink-soft">
                  <span className="font-medium text-ink">Por quê:</span> {rec.porQue}
                </p>
                <p className="text-[12.5px] text-ink-soft">
                  <span className="font-medium text-ink">Evidência:</span> {rec.evidencia}
                </p>
                <p className="text-[12.5px] text-ink-soft">
                  <span className="font-medium text-ink">Como:</span> {rec.como}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge tone="neutral" size="xs">Quando: {rec.quando}</Badge>
                  <Badge tone="neutral" size="xs">Métrica: {rec.metrica}</Badge>
                  <Badge tone="success" size="xs">Confiança {Math.round(rec.confianca * 100)}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      {actions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <CheckCircle2 size={15} className="text-purple" />
            Plano de ação
          </h3>
          <div className="flex flex-col gap-2">
            {actions.slice(0, 8).map((a) => (
              <div key={a.id} className="rounded-xl bg-white border border-soft px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{a.title}</p>
                  <p className="text-[11.5px] text-ink-soft">
                    {PRIORITY_LABEL[a.priority]} · {a.status}
                    {a.dueAt ? ` · até ${a.dueAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => updateAction(a.id, "IN_PROGRESS")}>
                      Iniciar
                    </Button>
                  )}
                  {(a.status === "PENDING" || a.status === "IN_PROGRESS") && (
                    <Button size="sm" variant="success" onClick={() => updateAction(a.id, "COMPLETED")}>
                      <CheckCircle2 size={13} /> Concluir
                    </Button>
                  )}
                  {a.status === "PENDING" && (
                    <Button size="sm" variant="ghost" onClick={() => updateAction(a.id, "DISMISSED")}>
                      <XCircle size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plano de 7 dias */}
      {plan7?.days?.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <Calendar size={15} className="text-purple" />
            Plano de 7 dias
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(plan7 as Plan7).days.map((d: DayPlan) => (
              <div key={d.day} className="rounded-2xl bg-white border border-soft p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Badge tone="neutral" size="xs">Dia {d.day}</Badge>
                  <span className="text-[10.5px] text-ink-muted">{d.date}</span>
                </div>
                <p className="text-[12.5px] font-semibold text-ink">{d.focus}</p>
                <div className="flex flex-col gap-1">
                  {d.items.map((item: DayPlan["items"][number], i: number) => (
                    <p key={i} className="text-[11px] text-ink-soft leading-snug">
                      • {item.action}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plano de 30 dias */}
      {plan30?.weeks?.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <CalendarRange size={15} className="text-purple" />
            Plano de 30 dias
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(plan30 as Plan30).weeks.map((w: Plan30["weeks"][number]) => (
              <div key={w.week} className="rounded-2xl bg-white border border-soft p-3 flex flex-col gap-1.5">
                <Badge tone="info" size="xs">Semana {w.week}</Badge>
                <p className="text-[12.5px] font-semibold text-ink">{w.theme}</p>
                <div className="flex flex-col gap-1">
                  {w.items.map((item: string, i: number) => (
                    <p key={i} className="text-[11px] text-ink-soft leading-snug">• {item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* O que mudou */}
      {changes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[15px] font-bold text-ink flex items-center gap-2">
            <TrendingUp size={15} className="text-purple" />
            O que mudou
          </h3>
          <div className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-1.5">
            {changes.map((c, i) => (
              <p key={i} className="text-[12.5px] text-ink-soft">• {c}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
