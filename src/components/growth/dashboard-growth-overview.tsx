import Link from "next/link";
import { Target, Zap, AlertTriangle, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { GrowthPipelineOutput } from "@/lib/growth-engine";

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

/**
 * Visão do Growth Engine no Dashboard (Parte 13).
 * Server component — recebe o output do pipeline (dados reais).
 * Exibe MISSÃO DO DIA, PRIORIDADES e SINAIS IMPORTANTES.
 */
export function DashboardGrowthOverview({
  output,
}: {
  output: GrowthPipelineOutput;
}) {
  const { mission, priorities, insights } = output;
  const hasAnything =
    (mission?.action != null || mission?.rationale) ||
    priorities.length > 0 ||
    insights.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-[16px] font-bold text-ink flex items-center gap-2">
          <Zap size={16} className="text-purple" />
          Automações Inteligentes
        </h2>
        <Link
          href="/growth"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-purple hover:text-indigo transition-colors"
        >
          Ver motor completo
          <ChevronRight size={14} />
        </Link>
      </div>

      {!hasAnything ? (
        <div className="rounded-2xl bg-surface/70 border border-dashed border-[#D0D4DB] px-5 py-6 text-center">
          <p className="text-[13px] text-ink-soft">
            Conecte e sincronize uma rede social para o motor começar a gerar recomendações.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Missão do dia */}
          <div className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-purple font-semibold text-[12px] uppercase tracking-wide">
              <Target size={14} />
              Missão do dia
            </div>
            {mission?.action ? (
              <>
                <p className="text-[14px] font-semibold text-ink">{mission.action.title}</p>
                <p className="text-[12px] text-ink-soft line-clamp-2">{mission.rationale}</p>
                <div className="flex gap-1.5 mt-0.5">
                  <Badge tone={mission.action.status === "PENDING" ? "info" : "warning"}>
                    {mission.action.status}
                  </Badge>
                  {mission.action.priority && (
                    <Badge tone="neutral">{PRIORITY_LABEL[mission.action.priority]}</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-ink-soft">
                {mission?.rationale ?? "DADO INSUFICIENTE — sincronize os dados para liberar a missão."}
              </p>
            )}
          </div>

          {/* Prioridades */}
          <div className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-purple font-semibold text-[12px] uppercase tracking-wide">
              <Zap size={14} />
              Prioridades
            </div>
            {priorities.length > 0 ? (
              <div className="flex flex-col gap-2">
                {priorities.map((p) => (
                  <div key={p.level} className="flex items-start gap-2">
                    <Badge tone={p.level === 1 ? "danger" : p.level === 2 ? "warning" : "info"}>
                      {p.level}
                    </Badge>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-[12.5px] font-semibold text-ink leading-snug">{p.title}</p>
                      <p className="text-[11px] text-ink-soft line-clamp-1">{p.evidenceSummary}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft">
                Nenhuma prioridade detectada agora.
              </p>
            )}
          </div>

          {/* Sinais importantes */}
          <div className="rounded-2xl bg-white border border-soft p-4 flex flex-col gap-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-purple font-semibold text-[12px] uppercase tracking-wide">
              <AlertTriangle size={14} />
              Sinais
            </div>
            {insights.length > 0 ? (
              <div className="flex flex-col gap-2">
                {insights.slice(0, 3).map((ins) => (
                  <div key={ins.id} className="flex items-start gap-2">
                    <Badge tone={SEVERITY_TONE[ins.severity] ?? "neutral"} size="sm">
                      {ins.severity}
                    </Badge>
                    <p className="text-[12px] text-ink-soft leading-snug line-clamp-2">{ins.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft">
                Sem sinais relevantes. Volte após sincronizar novos dados.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
