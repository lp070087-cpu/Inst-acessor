"use client";

import * as React from "react";
import {
  Sparkles,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  LayoutGrid,
  Target,
  TrendingUp,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * CALENDÁRIO INTELIGENTE DO INST ACESSOR — apresentação
 * =====================================================
 * Este componente NÃO calcula nada. Ele apenas renderiza o que o motor puro
 * (`src/lib/planning/smart-calendar.ts`) já decidiu no servidor, incluindo a
 * distinção entre "tem dado" e "não tem dado".
 *
 * A ausência é exibida sempre com a MESMA frase oficial, nunca maquiada por um
 * número zero nem por uma sugestão genérica.
 */

export type SmartRecommendationKind =
  | "lacunas-semana"
  | "cadencia"
  | "melhores-dias"
  | "melhores-formatos"
  | "tendencia-alcance"
  | "metas-prazo";

export interface SmartRecommendationView {
  kind: SmartRecommendationKind;
  title: string;
  body: string;
  evidence: string[];
  available: boolean;
}

export interface SmartCalendarView {
  recommendations: SmartRecommendationView[];
  availableCount: number;
  total: number;
  context: {
    plannedCount: number;
    mediaCount: number;
    mediaWithInteractions: number;
    classifiedMediaCount: number;
    snapshotCount: number;
    activeGoals: number;
    windowDays: number;
  };
}

function kindIcon(kind: SmartRecommendationKind) {
  if (kind === "lacunas-semana") return CalendarCheck;
  if (kind === "cadencia") return CalendarClock;
  if (kind === "melhores-dias") return CalendarDays;
  if (kind === "melhores-formatos") return LayoutGrid;
  if (kind === "tendencia-alcance") return TrendingUp;
  return Target;
}

function RecommendationCard({ rec }: { rec: SmartRecommendationView }) {
  const Icon = kindIcon(rec.kind);

  return (
    <div
      className={cn(
        "rounded-[14px] bg-card border p-4 flex flex-col gap-2.5 min-w-0",
        rec.available ? "border-border-soft shadow-xs" : "border-dashed border-border"
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span
          aria-hidden="true"
          className={cn(
            "w-7 h-7 rounded-[9px] grid place-items-center flex-none border",
            rec.available
              ? "bg-ai-soft text-purple border-purple/15"
              : "bg-surface text-ink-muted border-border-soft"
          )}
        >
          <Icon size={15} />
        </span>
        <h3 className="font-display text-[14px] font-semibold text-ink flex-1 min-w-0 break-words">
          {rec.title}
        </h3>
        {!rec.available && (
          <Badge tone="neutral" size="xs" className="flex-none">
            Sem dado
          </Badge>
        )}
      </div>

      <p
        className={cn(
          "text-[12.5px] leading-relaxed",
          rec.available ? "text-ink-soft" : "text-ink-muted"
        )}
      >
        {rec.body}
      </p>

      {/* Evidência: sem ela, uma conclusão correta é indistinguível de palpite. */}
      {rec.available && rec.evidence.length > 0 && (
        <ul className="flex flex-col gap-1 pt-1 border-t border-border-soft">
          {rec.evidence.map((e, i) => (
            <li key={i} className="text-[11.5px] text-ink-muted flex items-start gap-1.5">
              <span aria-hidden="true" className="text-purple flex-none leading-[1.5]">
                ·
              </span>
              <span className="min-w-0 break-words">{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SmartCalendarClient({ data }: { data: SmartCalendarView }) {
  const { context } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] bg-ai-soft border border-purple/15 px-4 py-3 flex items-start gap-2.5">
        <Sparkles size={16} className="flex-none mt-0.5 text-purple" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">
            Calendário Inteligente do Inst Acessor
          </p>
          <p className="text-[12.5px] text-ink-soft mt-0.5">
            {data.availableCount} de {data.total} análises têm dado real suficiente.
            {data.availableCount < data.total &&
              " As demais dizem exatamente o que falta — nenhuma é preenchida com estimativa."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.recommendations.map((r) => (
          <RecommendationCard key={r.kind} rec={r} />
        ))}
      </div>

      <div className="rounded-[14px] bg-surface/40 border border-border-soft px-4 py-3 flex items-start gap-2.5">
        <Info size={15} className="flex-none mt-0.5 text-ink-muted" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-ink-soft">
            Dados considerados nestas análises
          </p>
          <p className="text-[12px] text-ink-muted mt-0.5 leading-relaxed">
            {context.plannedCount} conteúdo(s) planejado(s) · {context.mediaCount}{" "}
            publicação(ões) coletada(s) · {context.mediaWithInteractions} com interação
            medida · {context.classifiedMediaCount} classificada(s) por formato pela Meta ·{" "}
            {context.snapshotCount} sincronização(ões) · {context.activeGoals} meta(s)
            ativa(s) · janela de {context.windowDays} dias.
          </p>
        </div>
      </div>
    </div>
  );
}
