"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Video,
  CircleDot,
  FileText,
  UserRound,
  TrendingUp,
  HeartHandshake,
  Loader2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  Opportunity,
  OpportunityCategory,
  OpportunityPriority,
  OpportunitiesData,
} from "@/lib/ai/opportunities";

/**
 * SEÇÃO "OPORTUNIDADES DETECTADAS PELA IA"
 * =========================================
 * Renderiza as oportunidades derivadas dos dados REAIS do usuário (ver
 * `@/lib/ai/opportunities`). Cada cartão mostra diagnóstico, dados utilizados,
 * recomendação e um botão que LEVA a um recurso existente de verdade.
 *
 * Honestidade:
 *   - cartão de INFERENCIA traz o rótulo "Inferência" (a ação é tática, não um
 *     resultado medido) — nunca é apresentado como medição;
 *   - "sem dados" e "IA não configurada" degradam com uma mensagem clara, nunca
 *     com números ou cartões inventados;
 *   - a categoria "Anúncios" não existe aqui: sem dado real de anúncio, ela
 *     não é renderizada.
 */

const CATEGORY_ICON: Record<OpportunityCategory, LucideIcon> = {
  Reels: Video,
  Stories: CircleDot,
  Conteúdo: FileText,
  Perfil: UserRound,
  Crescimento: TrendingUp,
  Engajamento: HeartHandshake,
};

const PRIORITY_TONE: Record<OpportunityPriority, "danger" | "warning" | "neutral"> = {
  ALTA: "danger",
  MÉDIA: "warning",
  BAIXA: "neutral",
};

interface AIState {
  state: "ok" | "not_configured" | "insufficient_data" | "error";
  summary: string | null;
  message: string | null;
}

interface OpportunitiesSectionProps {
  data: OpportunitiesData;
}

export function OpportunitiesSection({ data }: OpportunitiesSectionProps) {
  const { toast } = useToast();
  const [ai, setAi] = React.useState<AIState | null>(null);
  const [loading, setLoading] = React.useState(false);

  const { opportunities, insufficientData, omittedNote } = data;

  async function prioritizeWithAI() {
    setLoading(true);
    try {
      const res = await fetch("/api/opportunities/summarize", { method: "GET" });
      const json = await res.json();
      // "Sem IA" e "sem dados" são estados NORMAIS (200) — só a falha real (502)
      // aparece como erro no toast.
      if (!res.ok) {
        toast(json?.message ?? "Não foi possível priorizar com a IA agora.", "error");
        return;
      }
      setAi(json);
    } catch {
      toast("Não foi possível falar com a IA agora.", "error");
    } finally {
      setLoading(false);
    }
  }

  // ---- Sem nada derivável ----
  if (opportunities.length === 0) {
    const message = !data.connected
      ? "Conecte sua conta do Instagram em Redes Sociais para o motor derivar oportunidades dos seus dados reais. Nada é inventado enquanto isso."
      : "Ainda não há dados coletados suficientes para o motor derivar oportunidades com honestidade. Sincronize seu perfil e volte aqui.";
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader />
        <div className="rounded-lg bg-card border border-border-soft shadow-xs p-10 text-center">
          <p className="text-[13.5px] text-ink-soft max-w-lg mx-auto">{message}</p>
          {!data.connected && (
            <Link
              href="/redes-sociais"
              className={cn(buttonClass({ variant: "primary", size: "sm" }), "mt-5")}
            >
              Conectar Instagram
            </Link>
          )}
        </div>
        {omittedNote && <OmittedNote text={omittedNote} />}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader />
        <button
          onClick={prioritizeWithAI}
          disabled={loading}
          className={buttonClass({ variant: "outline", size: "sm" })}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Analisando…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Priorizar com IA
            </>
          )}
        </button>
      </div>

      {insufficientData && (
        <p className="text-[12.5px] text-ink-muted px-1">
          Histórico curto: menos de duas sincronizações. Oportunidades que dependem de tendência não aparecem até haver
          histórico real para sustentá-las.
        </p>
      )}

      {/* Texto da IA (opcional) — só quando ela respondeu de verdade. */}
      {ai && ai.state === "ok" && ai.summary && (
        <div className="rounded-[14px] bg-ai-soft border border-purple/20 p-4 flex gap-3">
          <Sparkles size={18} className="text-purple flex-none mt-0.5" />
          <p className="text-[13.5px] text-ink leading-relaxed">{ai.summary}</p>
        </div>
      )}
      {ai && ai.state !== "ok" && ai.message && (
        <p className="text-[12.5px] text-ink-muted px-1">{ai.message}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {opportunities.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>

      {omittedNote && <OmittedNote text={omittedNote} />}
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-[12px] bg-ai-soft text-purple grid place-items-center">
        <Sparkles size={18} />
      </span>
      <div className="flex flex-col">
        <h2 className="font-display text-[16px] font-bold text-ink">Oportunidades detectadas pela IA</h2>
        <p className="text-[12.5px] text-ink-muted">
          Derivadas dos seus dados reais. Nada é estimado.
        </p>
      </div>
    </div>
  );
}

function OmittedNote({ text }: { text: string }) {
  return (
    <p className="text-[12px] text-ink-muted px-1 leading-relaxed">
      <span className="font-semibold text-ink-soft">Transparência: </span>
      {text}
    </p>
  );
}

function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  const Icon = CATEGORY_ICON[o.category];

  return (
    <article className="rounded-[14px] bg-card border border-border-soft shadow-xs p-5 flex flex-col gap-3.5">
      {/* Cabeçalho: categoria + prioridade + base */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-[10px] bg-ai-soft text-purple grid place-items-center flex-none">
            <Icon size={16} />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {o.category}
            </span>
            <h3 className="font-display text-[14.5px] font-bold text-ink leading-snug">{o.title}</h3>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-none">
          <Badge tone={PRIORITY_TONE[o.priority]} size="xs">
            {o.priority}
          </Badge>
          <Badge tone={o.basis === "DADO_REAL" ? "success" : "brand"} size="xs">
            {o.basis === "DADO_REAL" ? "Dado real" : "Inferência"}
          </Badge>
        </div>
      </div>

      {/* Diagnóstico */}
      <p className="text-[13px] text-ink-soft leading-relaxed">{o.diagnosis}</p>

      {/* Dados utilizados */}
      <div className="rounded-[10px] bg-bg-ice border border-border-soft p-3 flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Dados utilizados
        </span>
        <ul className="flex flex-col gap-1">
          {o.evidence.map((e, i) => (
            <li key={i} className="text-[12px] text-ink-soft flex gap-1.5">
              <span className="text-purple flex-none">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recomendação */}
      <div className="flex gap-2">
        <Sparkles size={15} className="text-purple flex-none mt-0.5" />
        <p className="text-[13px] text-ink leading-relaxed">{o.recommendation}</p>
      </div>

      {/* Ação REAL */}
      <Link
        href={o.action.href}
        className={cn(buttonClass({ variant: "primary", size: "sm" }), "self-start mt-1")}
      >
        {o.action.label}
        <ChevronRight size={16} />
      </Link>
    </article>
  );
}
