"use client";

import { useState } from "react";
import { Brain, Sparkles, RefreshCw, AlertTriangle, Info } from "lucide-react";

import type { AIInsightsResult } from "@/lib/dashboard/insights";

/**
 * "Insights rápidos da IA" do Dashboard.
 *
 * Recebe do servidor as observações determinísticas (derivadas só de dados
 * reais) e, sob demanda, pede os insights da IA CENTRAL.
 *
 * A IA NUNCA é chamada sozinha: o usuário clica. Isso respeita a regra de não
 * gastar chamada sem necessidade e deixa claro de onde veio cada frase.
 */
export interface DeterministicInsightView {
  key: string;
  text: string;
  evidence: string;
  tone: "positive" | "attention" | "neutral";
}

interface DashboardInsightsProps {
  deterministic: DeterministicInsightView[];
  connected: boolean;
  /**
   * A IA central está configurada? (checado no servidor, sem expor chave).
   * `false` → o botão aparece desabilitado com a razão, sem tentar a chamada.
   */
  aiConfigured: boolean;
}

export function DashboardInsights({
  deterministic,
  connected,
  aiConfigured,
}: DashboardInsightsProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AIInsightsResult | null>(null);

  async function handleGenerate() {
    setState("loading");
    try {
      const res = await fetch("/api/dashboard/insights");
      const data = (await res.json()) as AIInsightsResult;
      setResult(data);
      // 502 = a IA existe mas falhou. Os demais estados são informativos.
      setState(res.ok && data.state === "ok" ? "done" : "error");
    } catch {
      setResult({
        state: "error",
        insights: null,
        message: "Falha de rede. Tente novamente.",
        providerFailed: true,
      });
      setState("error");
    }
  }

  return (
    <section className="bg-card border border-border-soft rounded-lg shadow-xs p-6 min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-bold text-ink flex items-center gap-2">
            <Brain size={18} className="text-purple flex-none" />
            Insights rápidos da IA
          </h2>
          <p className="text-[13px] text-ink-soft mt-0.5 break-words">
            Leitura objetiva dos seus números. A IA só comenta o que foi coletado de verdade.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={state === "loading" || !connected || !aiConfigured}
          className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-pill border border-border-soft bg-surface text-ink-soft transition-all duration-200 hover:text-ink hover:border-border disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer flex-none"
        >
          {state === "loading" ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Gerar insights
        </button>
      </div>

      {/* Observações determinísticas — funcionam sem IA, com o valor que as sustenta. */}
      {deterministic.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {deterministic.map((item) => (
            <li
              key={item.key}
              className="rounded-[16px] bg-surface/50 border border-border-soft p-4 min-w-0"
            >
              <p className="text-[13.5px] text-ink font-medium break-words">{item.text}</p>
              <p className="text-[12px] text-ink-muted mt-1 break-words">{item.evidence}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[16px] bg-surface/40 border border-dashed border-[#D0D4DB] p-6 text-center">
          <Info size={18} className="text-ink-muted mx-auto mb-2" />
          <p className="text-[13px] text-ink-soft">
            {connected
              ? "Ainda não há dados suficientes para gerar observações. Sincronize seu Instagram."
              : "Conecte seu Instagram para liberar os insights."}
          </p>
        </div>
      )}

      {/* Resultado da IA */}
      {result && (
        <div className="mt-4 rounded-[16px] border border-border-soft bg-brand-grad-soft p-4 min-w-0">
          {result.state === "ok" && result.insights ? (
            <div className="flex gap-3 min-w-0">
              <Sparkles size={16} className="text-purple flex-none mt-0.5" />
              <p className="text-[13.5px] text-ink break-words whitespace-pre-line">
                {result.insights}
              </p>
            </div>
          ) : (
            <div className="flex gap-3 min-w-0">
              <AlertTriangle size={16} className="text-ink-muted flex-none mt-0.5" />
              <p className="text-[13px] text-ink-soft break-words">
                {result.message ?? "Insights indisponíveis no momento."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Razão explícita quando o botão está desabilitado — nada fica implícito. */}
      {!aiConfigured && (
        <p className="mt-4 text-[12px] text-ink-muted">
          A análise por IA fica disponível assim que a chave for configurada no painel
          administrativo. As observações acima não dependem dela.
        </p>
      )}
    </section>
  );
}
