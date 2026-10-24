"use client";

import * as React from "react";
import { Loader2, Mail, User, Check, BellRing, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * LISTA DE ESPERA — formulário PÚBLICO (usado no /checkout)
 * ===========================================================
 * Aparece quando não há vaga (teto atingido ou vendas fechadas). Coleta nome
 * (opcional) + e-mail com CONSENTIMENTO EXPLÍCITO (checkbox). O servidor
 * revalida tudo e é idempotente por e-mail.
 *
 * NÃO é usado na landing (que é congelada) — só no checkout.
 */
export function WaitlistForm({
  planSlug,
  message,
  authedEmail,
}: {
  planSlug?: string;
  message: string;
  authedEmail?: string | null;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(authedEmail ?? "");
  const [consent, setConsent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast("Informe seu e-mail.", "error");
      return;
    }
    if (!consent) {
      toast("Marque a caixa para aceitar ser avisado por e-mail.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
          consent: true,
          ...(planSlug ? { planSlug } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível entrar na lista agora.", "error");
        return;
      }
      setDone(true);
      toast("Você entrou na lista de espera.", "success");
    } catch {
      toast("Erro de conexão. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[14px] border border-success/25 bg-success-soft px-5 py-5 flex items-start gap-3">
        <CheckCircle2 size={20} className="flex-none mt-0.5 text-success" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">Você está na lista</p>
          <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">
            Avisaremos por e-mail assim que uma vaga abrir. Nenhuma cobrança foi feita.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-purple/25 bg-ai-soft/50 px-5 py-5">
      <div className="flex items-start gap-2.5 mb-4">
        <BellRing size={18} className="flex-none mt-0.5 text-purple" />
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink">Entre na lista de espera</p>
          <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed break-words">
            {message || "As vagas foram preenchidas. Avisaremos quando abrir uma nova."}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">
            Seu nome <span className="text-ink-muted font-normal">(opcional)</span>
          </span>
          <div className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-3 h-11 focus-within:border-purple/40">
            <User size={16} className="flex-none text-ink-muted" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como podemos te chamar?"
              className="w-full min-w-0 bg-transparent text-[14px] text-ink placeholder:text-ink-muted outline-none"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">
            Seu e-mail <span className="text-ink-muted font-normal">(obrigatório)</span>
          </span>
          <div className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-3 h-11 focus-within:border-purple/40">
            <Mail size={16} className="flex-none text-ink-muted" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              className="w-full min-w-0 bg-transparent text-[14px] text-ink placeholder:text-ink-muted outline-none"
              required
            />
          </div>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-purple flex-none"
          />
          <span className="text-[12px] text-ink-soft leading-relaxed">
            Autorizo o Inst Acessor a me avisar por e-mail quando uma vaga abrir. Sem
            spam, só o aviso da vaga.
          </span>
        </label>

        <Button type="submit" variant="primary" size="lg" block disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {loading ? "Entrando…" : "Entrar na lista de espera"}
        </Button>
      </form>
    </div>
  );
}
