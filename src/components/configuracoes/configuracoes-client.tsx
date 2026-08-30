"use client";

import * as React from "react";
import { Loader2, Globe, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ConfiguracoesClientProps {
  initial: {
    locale: string;
    timezone: string;
  };
}

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Belem",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
] as const;

const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
] as const;

/**
 * CONFIGURAÇÕES — Fase 10 (#156)
 * ==============================
 * Preferências da conta do usuário (idioma e fuso horário).
 *
 * - Persiste via `PATCH /api/configuracoes` (owner-check + Zod).
 * - `UserPreferences` é o modelo base (Fase 1) — sem necessidade de shim.
 * - Feedback via toast; estado de carregamento no botão.
 */
export function ConfiguracoesClient({ initial }: ConfiguracoesClientProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [locale, setLocale] = React.useState(initial.locale);
  const [timezone, setTimezone] = React.useState(initial.timezone);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, timezone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      toast("Preferências salvas.", "success");
    } catch {
      toast("Erro de rede ao salvar.", "error");
    } finally {
      setLoading(false);
    }
  }

  const labelCls = "text-[13px] font-semibold text-ink";
  const selectCls =
    "h-11 w-full rounded-[12px] border border-border bg-bg-ice px-3 text-[14px] text-ink focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow cursor-pointer";

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Globe size={15} className="text-ink-muted" />
            Idioma
          </span>
          <select
            className={selectCls}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Clock size={15} className="text-ink-muted" />
            Fuso horário
          </span>
          <select
            className={selectCls}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[12.5px] text-ink-soft leading-relaxed">
        O fuso horário é usado para o calendário de conteúdo e o horário de publicação
        programada.
      </p>

      <div className="flex justify-end">
        <Button type="submit" size="md" disabled={loading}>
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
          {loading ? "Salvando..." : "Salvar preferências"}
        </Button>
      </div>
    </form>
  );
}
