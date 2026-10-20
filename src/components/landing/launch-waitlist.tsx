"use client";
import * as React from "react";
import { ArrowRight, CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { PLAN_CATALOG, planShortName } from "@/lib/billing/plans/display";
const choices = ["semanal", "mensal", "anual"].map(slug => PLAN_CATALOG.find(plan => plan.slug === slug)!);

export function WaitlistPlanLink({ slug, label }: { slug: string; label: string }) {
  return <a href="#lista-de-espera" className="lnd-btn lnd-btn-block lnd-btn-ghost lnd-waitlist-plan" aria-label={`Entrar na lista de espera — ${label}`} onClick={event => {
    event.preventDefault(); window.dispatchEvent(new CustomEvent("inst-waitlist-plan", { detail: slug }));
    document.getElementById("lista-de-espera")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.getElementById("waitlist-name")?.focus({ preventScroll: true });
  }}>Entrar na lista de espera <ArrowRight size={17} aria-hidden="true" /></a>;
}
export function LaunchWaitlist() {
  const [plan, setPlan] = React.useState(""); const [fromPlan, setFromPlan] = React.useState(false);
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState<string | null>(null); const [error, setError] = React.useState<string | null>(null);
  const feedback = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function choose(event: Event) { const slug: unknown = (event as CustomEvent<unknown>).detail; if (typeof slug === "string" && choices.some(p => p.slug === slug)) { setPlan(slug); setFromPlan(true); } }
    window.addEventListener("inst-waitlist-plan", choose); return () => window.removeEventListener("inst-waitlist-plan", choose);
  }, []);
  React.useEffect(() => { if (message || error) feedback.current?.focus(); }, [message, error]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, fields = new FormData(form);
    const name = String(fields.get("name") ?? "").trim(), email = String(fields.get("email") ?? "").trim();
    const whatsapp = String(fields.get("whatsapp") ?? "").replace(/[\s().-]/g, "");
    const emailConsent = fields.get("emailConsent") === "on", whatsappConsent = fields.get("whatsappConsent") === "on";
    setError(null); setMessage(null);
    if (name.length < 2 || name.length > 100 || !form.checkValidity() || !plan) { setError("Confira seu nome, email e plano de interesse."); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) { setError("Informe WhatsApp com +, código do país, DDD e número. Exemplo: +55 11 99999-9999."); return; }
    if (!emailConsent && !whatsappConsent) { setError("Escolha pelo menos um canal para receber novidades. Você pode cancelar depois."); return; }
    setBusy(true); const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/launch-waitlist", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp, planSlug: plan, emailConsent, whatsappConsent, source: fromPlan ? "landing-plan" : "landing", website: String(fields.get("website") ?? "") }) });
      if (!response.ok) { setError(response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Não foi possível registrar agora. Tente novamente mais tarde."); return; }
      const result: { ok?: boolean } = await response.json(); if (!result.ok) { setError("Não foi possível concluir a solicitação."); return; }
      setMessage("Solicitação recebida. A inscrição fica ativa após a confirmação do email. O recebimento da mensagem depende da disponibilidade do serviço de envio.");
      form.reset(); setPlan(""); setFromPlan(false);
    } catch { setError("Não foi possível confirmar o cadastro. Verifique sua conexão antes de tentar novamente."); }
    finally { window.clearTimeout(timer); setBusy(false); }
  }
  return <section className="lnd-section lnd-waitlist-section" id="lista-de-espera" aria-labelledby="waitlist-title"><div className="lnd-container lnd-waitlist-layout">
    <div className="lnd-waitlist-copy"><span className="lnd-eyebrow">Antes do lançamento</span><h2 className="lnd-h2" id="waitlist-title">Seu próximo passo começa <span className="lnd-grad">por aqui.</span></h2>
      <p className="lnd-lead">Entre na lista de espera do Inst Acessor e escolha como quer saber da abertura da pré-venda.</p>
      <ul className="lnd-waitlist-benefits"><li><CheckCircle2 aria-hidden="true" size={19} /> Sem pagamento ou assinatura para participar</li><li><Mail aria-hidden="true" size={19} /> Você escolhe quais novidades receber</li><li><MessageCircle aria-hidden="true" size={19} /> Consentimentos separados e cancelamento a qualquer momento</li></ul>
      <p className="lnd-waitlist-note">A data de abertura ainda não foi anunciada. Sua inscrição não reserva uma compra nem garante desconto.</p></div>
    <form className="lnd-waitlist-form" onSubmit={submit} noValidate aria-busy={busy}><h3>Quero acompanhar o lançamento</h3><p>Conte só o necessário. Não é preciso criar uma conta.</p>
      {(error || message) && <div ref={feedback} tabIndex={-1} role={error ? "alert" : "status"} className={`lnd-waitlist-feedback ${error ? "is-error" : ""}`}>{error || message}</div>}
      <fieldset disabled={busy}>
        <label htmlFor="waitlist-name">Nome<input id="waitlist-name" name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>
        <label htmlFor="waitlist-email">Email<input id="waitlist-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required /></label>
        <label htmlFor="waitlist-whatsapp">WhatsApp com DDI e DDD<input id="waitlist-whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+55 11 99999-9999" maxLength={25} required aria-describedby="waitlist-phone-help" /></label><small id="waitlist-phone-help">Inclua o código do país. Usaremos este número somente se você autorizar abaixo.</small>
        <label htmlFor="waitlist-plan">Plano de interesse<select id="waitlist-plan" name="planSlug" value={plan} onChange={event => setPlan(event.target.value)} required><option value="">Selecione um plano</option>{choices.map(p => <option key={p.slug} value={p.slug}>{planShortName(p)}</option>)}</select></label>
        <div className="lnd-waitlist-honey" aria-hidden="true"><label>Não preencha<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="lnd-waitlist-consents"><label><input type="checkbox" name="emailConsent" /> <span>Quero receber por email novidades e o aviso de abertura da pré-venda.</span></label><label><input type="checkbox" name="whatsappConsent" /> <span>Quero receber pelo WhatsApp novidades e o aviso de abertura da pré-venda.</span></label></div>
        <p className="lnd-waitlist-note">Enviaremos um email de confirmação do cadastro, separado das mensagens promocionais. Saiba como tratamos seus dados na <a href="/privacidade">Política de Privacidade</a>. Você pode retirar seu consentimento e se descadastrar.</p>
        <button type="submit" className="lnd-btn lnd-btn-primary lnd-btn-block" disabled={busy}>{busy ? "Registrando…" : "Quero entrar na lista de espera"}<ArrowRight size={18} aria-hidden="true" /></button>
      </fieldset></form></div></section>;
}
