"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const OBJECTIVES = [
  { id: "crescer-seguidores", label: "Crescer seguidores" },
  { id: "aumentar-engajamento", label: "Aumentar engajamento" },
  { id: "melhorar-conteudo", label: "Melhorar conteúdo" },
  { id: "vender-pelo-instagram", label: "Vender pelo Instagram" },
  { id: "construir-autoridade", label: "Construir autoridade" },
  { id: "outro", label: "Outro" },
];

const NICHES = [
  "Moda",
  "Beleza e estética",
  "Fitness e saúde",
  "Gastronomia",
  "Viagem",
  "Tecnologia",
  "Negócios e empreendedorismo",
  "Educação",
  "Finanças e investimentos",
  "Casa e decoração",
  "Família e maternidade",
  "Humor e entretenimento",
  "Arte e cultura",
  "Esportes",
  "Games",
  "Fotografia",
  "Outro",
];

// Etapas do wizard. A etapa final (resumo) não entra no indicador "Passo X de 3".
const STEPS = 3;

type Step = 1 | 2 | 3 | 4;

export function OnboardingForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>(1);
  const [transitioning, setTransitioning] = React.useState(false);

  const [objective, setObjective] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [subNiche, setSubNiche] = React.useState("");
  const [otherNiche, setOtherNiche] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nicheValue = niche === "Outro" ? otherNiche : niche;

  /** Transição suave entre etapas (fade + leve slide). */
  function goTo(next: Step) {
    setError(null);
    setTransitioning(true);
    window.setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 220);
  }

  function handleSelectObjective(label: string) {
    setObjective(label);
    goTo(2);
  }

  function handleSelectNiche(value: string) {
    setNiche(value);
    goTo(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!objective) {
      setError("Escolha seu objetivo principal.");
      return;
    }
    if (!nicheValue || nicheValue.trim().length < 2) {
      setError("Informe seu nicho.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          niche: nicheValue,
          subNiche: subNiche || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar seu perfil.");
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }

      toast("Perfil configurado! Bem-vindo ao Inst Acessor.");
      // Rota pública real do route group (app) — nunca /app/dashboard.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível salvar seu perfil. Tente novamente.");
      toast("Não foi possível salvar seu perfil.", "error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow w-full";

  // `key` por etapa força remount → animação de entrada (fade + leve slide)
  // roda a cada mudança de pergunta.
  const cardCls = "flex flex-col gap-6 min-h-0 onboarding-step-enter";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Indicador de progresso discreto */}
      <div className="flex flex-col items-center gap-3">
        {step <= STEPS ? (
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Passo {step} de {STEPS}
          </span>
        ) : (
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
            Revisão
          </span>
        )}
        <div className="flex items-center gap-1.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-[6px] w-[6px] rounded-full transition-colors duration-300 ${
                step >= i ? "bg-brand-grad" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-[12px] bg-danger-softStrong border border-danger/20 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Etapa 1 — Objetivo principal */}
      {step === 1 && (
        <fieldset className={cardCls} key="step-1">
          <legend className="text-[13px] font-semibold text-ink mb-1">
            Qual é seu objetivo principal?
          </legend>
          <p className="text-[12.5px] text-ink-muted -mt-3 mb-1">
            Isso ajuda o Inst Acessor a personalizar sua experiência.
          </p>
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition-opacity duration-200 ${
              transitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {OBJECTIVES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectObjective(opt.label)}
                className={`text-left px-4 py-3 rounded-[12px] border font-medium text-[13.5px] transition-all cursor-pointer ${
                  objective === opt.label
                    ? "bg-ai-soft border-purple/40 text-purple font-semibold"
                    : "border-border bg-bg-ice text-ink-soft hover:border-purple/30 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Etapa 2 — Nicho */}
      {step === 2 && (
        <fieldset className={cardCls} key="step-2">
          <legend className="text-[13px] font-semibold text-ink mb-3">
            Qual seu nicho?
          </legend>
          <div
            className={`flex flex-wrap gap-2.5 transition-opacity duration-200 ${
              transitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {NICHES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleSelectNiche(n)}
                className={`inline-flex px-3.5 py-2 rounded-pill border font-medium text-[12.5px] transition-all cursor-pointer ${
                  niche === n
                    ? "bg-ai-soft border-purple/40 text-purple font-semibold"
                    : "border-border bg-bg-ice text-ink-soft hover:border-purple/30 hover:text-ink"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {niche === "Outro" && (
            <div
              className={`transition-opacity duration-200 ${
                transitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              <input
                value={otherNiche}
                onChange={(e) => setOtherNiche(e.target.value)}
                placeholder="Digite seu nicho"
                className={inputCls}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!otherNiche.trim()) {
                      setError("Digite seu nicho antes de continuar.");
                      return;
                    }
                    goTo(3);
                  }}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => goTo(1)}
              className="gap-1.5"
            >
              <ArrowLeft size={15} />
              Voltar
            </Button>
            {niche && niche !== "Outro" && (
              <span className="text-[12px] text-ink-muted flex items-center gap-1 min-w-0">
                <Check size={13} className="text-success flex-none" />
                <span className="min-w-0 truncate">{niche} selecionado</span>
              </span>
            )}
          </div>
        </fieldset>
      )}

      {/* Etapa 3 — Subnicho (opcional) */}
      {step === 3 && (
        <div className={cardCls} key="step-3">
          <div>
            <label
              htmlFor="subNiche"
              className="text-[13px] font-semibold text-ink"
            >
              Quer especificar melhor seu nicho?{" "}
              <span className="text-ink-muted font-normal">(opcional)</span>
            </label>
            <p className="text-[12.5px] text-ink-muted mt-1">
              Ex.: moda masculina, receitas low carb, estética automotiva...
            </p>
          </div>
          <input
            id="subNiche"
            value={subNiche}
            onChange={(e) => setSubNiche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goTo(4);
              }
            }}
            placeholder="Moda masculina, receitas low carb, estética automotiva..."
            className={inputCls}
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => goTo(2)}
              className="gap-1.5"
            >
              <ArrowLeft size={15} />
              Voltar
            </Button>
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="ghost" onClick={() => goTo(4)}>
                Pular
              </Button>
              <Button type="button" variant="outline" onClick={() => goTo(4)}>
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Etapa final — Resumo */}
      {step === 4 && (
        <div className={cardCls} key="step-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 rounded-[12px] border border-border bg-bg-ice px-4 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                Objetivo
              </span>
              <span className="text-[13.5px] font-medium text-ink text-right">
                {objective}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[12px] border border-border bg-bg-ice px-4 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                Nicho
              </span>
              <span className="text-[13.5px] font-medium text-ink text-right">
                {nicheValue}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[12px] border border-border bg-bg-ice px-4 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                Subnicho
              </span>
              <span className="text-[13.5px] font-medium text-ink text-right">
                {subNiche.trim() || "Não informado"}
              </span>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => goTo(3)}
              className="gap-1.5"
            >
              <ArrowLeft size={15} />
              Voltar
            </Button>
            <Button type="submit" size="lg" disabled={loading} className="gap-2">
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Salvando..." : "Começar no Inst Acessor"}
              {!loading && <ArrowRight size={17} />}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
