"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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

export function OnboardingForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [objective, setObjective] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [subNiche, setSubNiche] = React.useState("");
  const [otherNiche, setOtherNiche] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nicheValue = niche === "Outro" ? otherNiche : niche;

  async function onSubmit(e: React.FormEvent) {
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
      router.push("/app/dashboard");
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {error && (
        <div className="rounded-[12px] bg-danger-softStrong border border-danger/20 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Objetivo principal */}
      <fieldset>
        <legend className="text-[13px] font-semibold text-ink mb-3">
          Qual é seu objetivo principal?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {OBJECTIVES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setObjective(opt.label)}
              className={
                objective === opt.label
                  ? "text-left px-4 py-3 rounded-[12px] border font-semibold text-[13.5px] transition-all bg-ai-soft border-purple/40 text-purple"
                  : "text-left px-4 py-3 rounded-[12px] border border-border bg-bg-ice font-medium text-[13.5px] text-ink-soft hover:border-purple/30 hover:text-ink transition-all cursor-pointer"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Nicho */}
      <fieldset>
        <legend className="text-[13px] font-semibold text-ink mb-3">
          Qual seu nicho?
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {NICHES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNiche(n)}
              className={
                niche === n
                  ? "inline-flex px-3.5 py-2 rounded-pill border font-semibold text-[12.5px] transition-all bg-ai-soft border-purple/40 text-purple"
                  : "inline-flex px-3.5 py-2 rounded-pill border border-border bg-bg-ice font-medium text-[12.5px] text-ink-soft hover:border-purple/30 hover:text-ink transition-all cursor-pointer"
              }
            >
              {n}
            </button>
          ))}
        </div>
        {niche === "Outro" && (
          <input
            value={otherNiche}
            onChange={(e) => setOtherNiche(e.target.value)}
            placeholder="Digite seu nicho"
            className={`${inputCls} mt-3`}
          />
        )}
      </fieldset>

      {/* Subnicho (opcional) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="subNiche" className="text-[13px] font-semibold text-ink">
          Subnicho <span className="text-ink-muted font-normal">(opcional)</span>
        </label>
        <input
          id="subNiche"
          value={subNiche}
          onChange={(e) => setSubNiche(e.target.value)}
          placeholder="Ex.: moda masculina, receitas low carb..."
          className={inputCls}
        />
      </div>

      <Button type="submit" size="lg" block disabled={loading}>
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Salvando..." : "Ir para o Dashboard"}
      </Button>
    </form>
  );
}
