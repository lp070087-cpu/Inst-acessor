"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Preferences = { status: "PENDING" | "VERIFIED" | "UNSUBSCRIBED"; emailConsent: boolean; whatsappConsent: boolean };
type Action = { action: "read" } | { action: "update"; emailConsent: boolean; whatsappConsent: boolean } | { action: "unsubscribe" };

/**
 * Preferências da lista de espera. O token chega no fragmento (#token=...), é removido
 * da barra de endereço imediatamente e só vai ao servidor no corpo de um POST same-origin.
 */
export function WaitlistPreferences() {
  const [ready, setReady] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [current, setCurrent] = React.useState<Preferences | null>(null);
  const [email, setEmail] = React.useState(false);
  const [whatsapp, setWhatsapp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmUnsubscribe, setConfirmUnsubscribe] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const feedback = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);

  const call = React.useCallback(async (value: string, body: Action): Promise<Preferences | null> => {
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/launch-waitlist/preferences", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, ...body }) });
      const json: { ok?: boolean; preferences?: Preferences } | null = await response.json().catch(() => null);
      if (!response.ok || json?.ok !== true || !json.preferences) {
        setError(response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente novamente." : "Link inválido ou indisponível. Use o link completo recebido por email.");
        return null;
      }
      return json.preferences;
    } catch { setError("Não foi possível confirmar o resultado. Verifique sua conexão e tente novamente."); return null; }
    finally { window.clearTimeout(timer); }
  }, []);

  const apply = (value: Preferences) => { setCurrent(value); setEmail(value.emailConsent); setWhatsapp(value.whatsappConsent); };

  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const value = new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
    url.hash = ""; url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    setToken(value);
    if (!/^[a-f0-9]{64}$/.test(value)) { setReady(true); return; }
    void call(value, { action: "read" }).then(result => { if (result) apply(result); setReady(true); });
  }, [call]);
  React.useEffect(() => { if (error || message) feedback.current?.focus(); }, [error, message]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !current) return;
    setBusy(true); setError(null); setMessage(null);
    const result = await call(token, { action: "update", emailConsent: email, whatsappConsent: whatsapp });
    if (result) { apply(result); setMessage("Preferências salvas."); }
    setBusy(false);
  }
  async function unsubscribe() {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    const result = await call(token, { action: "unsubscribe" });
    if (result) { apply(result); setToken(""); setConfirmUnsubscribe(false); setMessage("Descadastro confirmado. Você não receberá mais avisos desta lista."); }
    setBusy(false);
  }

  const validToken = /^[a-f0-9]{64}$/.test(token);
  const unchanged = current ? current.emailConsent === email && current.whatsappConsent === whatsapp : true;
  return <main className="flex min-h-screen items-center justify-center bg-bg-ice px-4 py-10">
    <section aria-labelledby="preferences-title" className="w-full min-w-0 max-w-[520px] space-y-5 rounded-3xl border border-border-soft bg-card p-6 shadow-brand-lg sm:p-8">
      <Link href="/" className="inline-block rounded text-lg font-bold text-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Inst Acessor</Link>
      <h1 id="preferences-title" className="text-2xl font-bold text-ink">Preferências de avisos</h1>
      <p className="text-sm leading-6 text-ink-soft">Escolha por quais canais deseja receber novidades e o aviso de abertura dos planos. Isso não cria assinatura nem cancela uma assinatura paga.</p>
      {(message || error) && <div ref={feedback} tabIndex={-1} role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm leading-6 focus:outline-none focus:ring-2 ${error ? "border-danger/30 text-danger focus:ring-danger/30" : "border-purple/20 bg-ai-soft text-ink focus:ring-purple/30"}`}>{error ?? message}</div>}
      {!ready ? <p role="status" className="text-sm text-ink-muted">Carregando preferências...</p>
        : !current ? (!validToken && !error ? <p role="alert" className="text-sm leading-6 text-danger">Link inválido ou indisponível. Use o link completo recebido por email.</p> : null)
        : current.status === "UNSUBSCRIBED" ? <p className="rounded-xl border border-border-soft p-4 text-sm leading-6 text-ink-soft">Esta inscrição está descadastrada. Nenhum aviso desta lista será enviado.</p>
        : <form onSubmit={save} aria-busy={busy} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-3 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">Canais autorizados</legend>
            <label className="flex items-start gap-3 rounded-xl border border-border-soft p-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4" checked={email} onChange={event => setEmail(event.target.checked)} /><span><strong>Email</strong><br />Novidades do app e aviso de abertura dos planos.</span></label>
            <label className="flex items-start gap-3 rounded-xl border border-border-soft p-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4" checked={whatsapp} onChange={event => setWhatsapp(event.target.checked)} /><span><strong>WhatsApp</strong><br />Mensagens oficiais do Inst Acessor no número informado na inscrição.</span></label>
            {current.status === "PENDING" && <p className="text-xs leading-5 text-ink-muted">Sua inscrição ainda aguarda a confirmação por email. Nenhum aviso é enviado antes disso.</p>}
            <Button type="submit" block disabled={busy || unchanged} aria-busy={busy} className="whitespace-normal">{busy ? "Salvando..." : "Salvar preferências"}</Button>
          </fieldset>
          <div className="border-t border-border-soft pt-4">
            {!confirmUnsubscribe ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmUnsubscribe(true)} className="whitespace-normal">Cancelar inscrição na lista</Button>
              : <div className="space-y-3"><p className="text-sm leading-6 text-ink-soft">Confirmar o descadastro desativa todos os avisos desta lista. Não é possível reativar por esta página.</p>
                <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void unsubscribe()} className="whitespace-normal">{busy ? "Processando..." : "Confirmar descadastro"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmUnsubscribe(false)}>Voltar</Button></div></div>}
          </div>
        </form>}
      <Link href="/" className="inline-block rounded text-sm font-semibold text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Voltar ao site</Link>
    </section>
  </main>;
}
