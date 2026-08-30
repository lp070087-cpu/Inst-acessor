"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PRESET_DAYS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
] as const;

/**
 * Formulário de liberação manual de acesso (somente ADMIN).
 * - E-mail do usuário;
 * - Duração (7/30/90 ou personalizada em dias).
 * Envia para POST /api/admin/access-grant (autorizado no servidor).
 */
export function AdminAccessGrant() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [days, setDays] = React.useState<number>(30);
  const [customDays, setCustomDays] = React.useState<string>("");
  const [custom, setCustom] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const effectiveDays = custom
    ? Number(customDays)
    : days;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!Number.isInteger(effectiveDays) || effectiveDays < 1) {
      toast("Informe uma duração válida em dias.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/access-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, days: effectiveDays }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        result?: {
          message?: string;
          extended?: boolean;
          expiresAt?: string | null;
        };
      };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível liberar o acesso.", "error");
        return;
      }
      const base = data.result?.message ?? "Acesso liberado.";
      const extra = data.result?.expiresAt
        ? ` Expira em ${new Date(data.result.expiresAt).toLocaleDateString("pt-BR")}.`
        : "";
      toast(base + extra, "success");
      setEmail("");
      setCustomDays("");
      setCustom(false);
      setDays(30);
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-[13px] border border-border-soft bg-surface/40 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-purple/10 text-purple flex items-center justify-center shrink-0">
          <KeyRound size={17} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-ink">Liberar acesso manual</p>
          <p className="text-[12.5px] text-ink-muted">
            Concede ou estende acesso sem cobrança. Não cria conta para e-mails
            sem cadastro e não altera dados de pagamento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-soft">E-mail do usuário</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@exemplo.com"
            className="w-full px-3 py-2.5 rounded-[11px] border border-border bg-card text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30 focus:border-purple/50"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-soft">Duração</span>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_DAYS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setCustom(false);
                  setDays(p.value);
                }}
                className={
                  "px-3 py-2 rounded-[10px] border text-[13px] font-medium transition-colors " +
                  (!custom && days === p.value
                    ? "border-purple bg-purple/10 text-purple"
                    : "border-border bg-card text-ink-soft hover:border-purple/40")
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className={
                "px-3 py-2 rounded-[10px] border text-[13px] font-medium transition-colors " +
                (custom
                  ? "border-purple bg-purple/10 text-purple"
                  : "border-border bg-card text-ink-soft hover:border-purple/40")
              }
            >
              Personalizado
            </button>
          </div>
          {custom && (
            <input
              type="number"
              min={1}
              max={3650}
              required
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="dias"
              className="mt-1 w-28 px-3 py-2 rounded-[10px] border border-border bg-card text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
            />
          )}
        </div>
      </div>

      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Liberando..." : "Liberar acesso"}
        </Button>
      </div>
    </form>
  );
}
