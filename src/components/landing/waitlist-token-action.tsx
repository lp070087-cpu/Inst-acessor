"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function WaitlistTokenAction({ action }: { action: "confirm" | "unsubscribe" }) {
  const [ready, setReady] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initialized = React.useRef(false);
  const feedback = React.useRef<HTMLDivElement>(null);
  const confirming = action === "confirm";

  React.useEffect(() => {
    function readFragment() {
      const url = new URL(window.location.href);
      const value = new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
      url.hash = ""; url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
      setToken(value); setReady(true); setSuccess(false); setError(null);
    }
    if (!initialized.current) { initialized.current = true; readFragment(); }
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, []);
  React.useEffect(() => { if (error || success) feedback.current?.focus(); }, [error, success]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy || success || !/^[a-f0-9]{64}$/.test(token)) return;
    setBusy(true); setError(null);
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/api/launch-waitlist/${action}`, { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok || (await response.json()).ok !== true) { setError("Não foi possível concluir. O link pode estar inválido, expirado ou indisponível."); return; }
      setToken(""); setSuccess(true);
    } catch { setError("Não foi possível confirmar o resultado. Verifique sua conexão e tente novamente."); }
    finally { window.clearTimeout(timer); setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-bg-ice px-5 py-10">
    <section aria-labelledby="waitlist-action-title" className="w-full min-w-0 max-w-[480px] space-y-5 rounded-3xl border border-border-soft bg-card p-6 shadow-brand-lg sm:p-8">
      <Link href="/" className="inline-block rounded text-lg font-bold text-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Inst Acessor</Link>
      <h1 id="waitlist-action-title" className="text-2xl font-bold text-ink">{confirming ? "Confirmar inscrição" : "Cancelar inscrição"}</h1>
      <p className="text-sm leading-6 text-ink-soft">{confirming ? "Confirme sua inscrição na lista de espera. Isso não cria uma assinatura nem realiza um pagamento." : "Confirme o descadastro dos avisos da lista de espera. Isso não exclui sua conta nem cancela uma assinatura paga."}</p>
      {!ready ? <p role="status" className="text-sm text-ink-muted">Preparando confirmação...</p> : success ? <div ref={feedback} tabIndex={-1} role="status" className="rounded-xl border border-purple/20 bg-ai-soft p-4 text-sm leading-6 text-ink focus:outline-none focus:ring-2 focus:ring-purple/30">{confirming ? "Inscrição confirmada. Sua preferência foi registrada; isso não garante vaga, desconto ou entrega de mensagens." : "Descadastro confirmado. Os avisos desta lista foram desativados; não foi realizado cancelamento de assinatura paga."}</div> : !/^[a-f0-9]{64}$/.test(token) ? <p role="alert" className="text-sm leading-6 text-danger">Link inválido ou indisponível. Use o link completo recebido para esta ação.</p> : <form onSubmit={submit} aria-busy={busy} className="space-y-4">
        {error && <div ref={feedback} tabIndex={-1} role="alert" className="rounded-xl border border-danger/30 p-3 text-sm text-danger focus:outline-none focus:ring-2 focus:ring-danger/30">{error}</div>}
        <p className="text-xs leading-5 text-ink-muted">A ação só será solicitada quando você pressionar o botão abaixo.</p>
        <Button type="submit" block disabled={busy} aria-busy={busy} className="whitespace-normal motion-reduce:transform-none motion-reduce:transition-none">{busy ? "Processando..." : confirming ? "Confirmar minha inscrição" : "Confirmar meu descadastro"}</Button>
      </form>}
      <Link href="/#lista-de-espera" className="inline-block rounded text-sm font-semibold text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Voltar à lista de espera</Link>
    </section>
  </main>;
}
