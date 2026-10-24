"use client";
import * as React from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Loader2, Mail, MailCheck, MessageCircle, UserPlus } from "lucide-react";
import { PLAN_CATALOG, planLandingPeriod, planShortName } from "@/lib/billing/plans/display";
import { applyBrazilianPhoneEdit, BRAZILIAN_PHONE_MESSAGES, brazilianPhoneDigits, brazilianPhoneProblem } from "@/lib/launch-waitlist/phone";

const choices = ["semanal", "mensal", "anual"].map(slug => PLAN_CATALOG.find(plan => plan.slug === slug)!);
const PLAN_EVENT = "inst-waitlist-plan";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

type FieldKey = "name" | "email" | "whatsapp" | "plan" | "consent";
type Values = { name: string; email: string; whatsapp: string; plan: string; emailConsent: boolean; whatsappConsent: boolean };
const EMPTY: Values = { name: "", email: "", whatsapp: "", plan: "", emailConsent: false, whatsappConsent: false };
const FIELD_ORDER: FieldKey[] = ["name", "email", "whatsapp", "plan", "consent"];
const FOCUS_TARGET: Record<FieldKey, string> = { name: "waitlist-name", email: "waitlist-email", whatsapp: "waitlist-whatsapp", plan: "waitlist-plan", consent: "waitlist-consent-email" };

function validate(values: Values): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const name = values.name.trim(), email = values.email.trim();
  if (!name) errors.name = "Informe seu nome.";
  else if (name.length < 2) errors.name = "O nome precisa ter pelo menos 2 caracteres.";
  else if (name.length > 100) errors.name = "Use no máximo 100 caracteres.";
  if (!email) errors.email = "Informe seu email.";
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = "Confira o email. Exemplo: nome@dominio.com.br.";
  const phoneProblem = brazilianPhoneProblem(brazilianPhoneDigits(values.whatsapp));
  if (phoneProblem) errors.whatsapp = BRAZILIAN_PHONE_MESSAGES[phoneProblem];
  if (!choices.some(p => p.slug === values.plan)) errors.plan = "Escolha o plano de interesse.";
  if (!values.emailConsent && !values.whatsappConsent) errors.consent = "Escolha pelo menos um canal para receber novidades. Você pode cancelar depois.";
  return errors;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function WaitlistPlanLink({ slug, label }: { slug: string; label: string }) {
  return <a href="#lista-de-espera" className="lnd-btn lnd-btn-block lnd-btn-ghost lnd-waitlist-plan" aria-label={`Entrar na lista de espera — ${label}`} onClick={event => {
    event.preventDefault(); window.dispatchEvent(new CustomEvent(PLAN_EVENT, { detail: slug }));
    document.getElementById("lista-de-espera")?.scrollIntoView({ behavior: scrollBehavior() });
    document.getElementById("waitlist-name")?.focus({ preventScroll: true });
  }}>Entrar na lista de espera <ArrowRight size={17} aria-hidden="true" /></a>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="lnd-waitlist-error"><AlertCircle size={15} aria-hidden="true" /><span>{message}</span></p>;
}

function BrazilFlag() {
  return <svg className="lnd-waitlist-flag" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" focusable="false">
    <rect width="20" height="14" rx="2" fill="#009c3b" /><path d="M10 2 18 7l-8 5-8-5z" fill="#ffdf00" /><circle cx="10" cy="7" r="3" fill="#002776" />
  </svg>;
}

export function LaunchWaitlist() {
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [touched, setTouched] = React.useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = React.useState(false);
  const [fromPlan, setFromPlan] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ email: string } | null>(null);
  const busyRef = React.useRef(false);
  const feedback = React.useRef<HTMLDivElement>(null);
  const doneHeading = React.useRef<HTMLHeadingElement>(null);
  const phoneInput = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);
  const focusNameAfterReset = React.useRef(false);
  const [focusRequest, setFocusRequest] = React.useState(0);

  const errors = validate(values);
  const visible = (key: FieldKey) => (attempted || touched[key]) ? errors[key] : undefined;
  const touch = (key: FieldKey) => setTouched(current => current[key] ? current : { ...current, [key]: true });

  React.useEffect(() => {
    function choose(event: Event) {
      const slug: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof slug !== "string" || !choices.some(p => p.slug === slug)) return;
      setDone(current => { if (current) focusNameAfterReset.current = true; return null; });
      setValues(current => ({ ...current, plan: slug })); setFromPlan(true);
    }
    window.addEventListener(PLAN_EVENT, choose); return () => window.removeEventListener(PLAN_EVENT, choose);
  }, []);
  React.useEffect(() => { if (formError) feedback.current?.focus(); }, [formError]);
  React.useEffect(() => {
    if (done) { doneHeading.current?.focus(); return; }
    if (focusNameAfterReset.current) { focusNameAfterReset.current = false; document.getElementById("waitlist-name")?.focus(); }
  }, [done]);
  React.useEffect(() => {
    if (!focusRequest) return;
    const firstInvalid = FIELD_ORDER.find(key => document.getElementById(`waitlist-${key}-error`));
    if (!firstInvalid) return;
    const target = firstInvalid === "plan" ? document.querySelector<HTMLInputElement>('.lnd-waitlist-plans input[name="planSlug"]') : document.getElementById(FOCUS_TARGET[firstInvalid]);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [focusRequest]);
  React.useLayoutEffect(() => {
    const caret = pendingCaret.current; pendingCaret.current = null;
    const input = phoneInput.current;
    if (caret !== null && input && document.activeElement === input) input.setSelectionRange(caret, caret);
  }, [values.whatsapp]);

  function update<K extends keyof Values>(key: K, value: Values[K]) { setValues(current => ({ ...current, [key]: value })); if (formError) setFormError(null); }

  function onPhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const edit = applyBrazilianPhoneEdit(values.whatsapp, input.value, input.selectionStart ?? input.value.length);
    pendingCaret.current = edit.caret; update("whatsapp", edit.value);
  }

  function reset() {
    setValues(EMPTY); setTouched({}); setAttempted(false); setFromPlan(false); setFormError(null);
    focusNameAfterReset.current = true; setDone(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busyRef.current) return;
    setAttempted(true); setFormError(null);
    // Foco só depois do render, para o leitor de tela já encontrar a mensagem via aria-describedby.
    if (FIELD_ORDER.some(key => errors[key])) { setFocusRequest(n => n + 1); return; }
    const fields = new FormData(event.currentTarget);
    const email = values.email.trim();
    const payload = {
      name: values.name.trim(), email, whatsapp: `+55${brazilianPhoneDigits(values.whatsapp)}`, planSlug: values.plan,
      emailConsent: values.emailConsent, whatsappConsent: values.whatsappConsent, source: fromPlan ? "landing-plan" : "landing", website: String(fields.get("website") ?? ""),
    };
    busyRef.current = true; setBusy(true);
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/launch-waitlist", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        setFormError(response.status === 429 ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
          : response.status === 400 ? "Não conseguimos validar os dados. Confira os campos e tente novamente."
          : "Não foi possível registrar agora. Tente novamente mais tarde.");
        return;
      }
      const result: { ok?: boolean } = await response.json();
      if (!result.ok) { setFormError("Não foi possível concluir a solicitação. Tente novamente mais tarde."); return; }
      setDone({ email }); setValues(EMPTY); setTouched({}); setAttempted(false); setFromPlan(false);
    } catch {
      setFormError(controller.signal.aborted
        ? "O servidor demorou demais para responder. Verifique sua conexão e tente novamente."
        : "Não foi possível confirmar o cadastro. Verifique sua conexão antes de tentar novamente.");
    } finally { window.clearTimeout(timer); busyRef.current = false; setBusy(false); }
  }

  const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;
  const nameError = visible("name"), emailError = visible("email"), phoneError = visible("whatsapp"), planError = visible("plan"), consentError = visible("consent");
  const validClass = (key: FieldKey) => touched[key] && !errors[key] ? " is-valid" : "";

  return <section className="lnd-section lnd-waitlist-section" id="lista-de-espera" aria-labelledby="waitlist-title"><div className="lnd-container lnd-waitlist-layout">
    <div className="lnd-waitlist-copy"><span className="lnd-eyebrow">Antes do lançamento</span><h2 className="lnd-h2" id="waitlist-title">Seu próximo passo começa <span className="lnd-grad">por aqui.</span></h2>
      <p className="lnd-lead">Entre na lista de espera do Inst Acessor e escolha como quer saber da abertura da pré-venda.</p>
      <ul className="lnd-waitlist-benefits"><li><CheckCircle2 aria-hidden="true" size={19} /> Sem pagamento ou assinatura para participar</li><li><Mail aria-hidden="true" size={19} /> Você escolhe quais novidades receber</li><li><MessageCircle aria-hidden="true" size={19} /> Consentimentos separados e cancelamento a qualquer momento</li></ul>
      <p className="lnd-waitlist-note">A data de abertura ainda não foi anunciada. Sua inscrição não reserva uma compra nem garante desconto.</p></div>

    {done ? <div className="lnd-waitlist-form lnd-waitlist-done" aria-labelledby="waitlist-done-title">
      <div className="lnd-waitlist-done-icon" aria-hidden="true"><Check size={30} strokeWidth={2.75} /></div>
      <h3 id="waitlist-done-title" ref={doneHeading} tabIndex={-1}>Cadastro recebido!</h3>
      <p>Enviaremos um email de confirmação para <strong className="lnd-waitlist-done-email">{done.email}</strong>.</p>
      <div className="lnd-waitlist-done-steps">
        <MailCheck size={20} aria-hidden="true" />
        <p>Sua inscrição na lista de espera é ativada <strong>depois que você confirmar</strong> pelo link enviado nessa mensagem. Se não encontrar o email, confira as pastas de spam e promoções.</p>
      </div>
      <p className="lnd-waitlist-note">Você pode retirar seu consentimento e se descadastrar a qualquer momento. Saiba mais na <a href="/privacidade">Política de Privacidade</a>.</p>
      <button type="button" className="lnd-btn lnd-btn-ghost lnd-btn-block" onClick={reset}><UserPlus size={18} aria-hidden="true" />Cadastrar outra pessoa</button>
    </div>

    : <form className="lnd-waitlist-form" onSubmit={submit} noValidate aria-busy={busy} aria-describedby="waitlist-form-intro">
      <h3>Quero acompanhar o lançamento</h3><p id="waitlist-form-intro">Conte só o necessário. Não é preciso criar uma conta. Todos os campos são obrigatórios.</p>
      {formError && <div ref={feedback} tabIndex={-1} role="alert" className="lnd-waitlist-feedback is-error"><AlertCircle size={18} aria-hidden="true" /><span>{formError}</span></div>}
      <fieldset className="lnd-waitlist-fields" disabled={busy}>
        <div className={`lnd-waitlist-field${validClass("name")}`}>
          <label htmlFor="waitlist-name">Nome</label>
          <input id="waitlist-name" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" maxLength={100} required placeholder="Como podemos te chamar?"
            value={values.name} onChange={event => update("name", event.target.value)} onBlur={() => touch("name")}
            aria-invalid={nameError ? true : undefined} aria-describedby={describedBy(nameError && "waitlist-name-error")} />
          <FieldError id="waitlist-name-error" message={nameError} />
        </div>

        <div className={`lnd-waitlist-field${validClass("email")}`}>
          <label htmlFor="waitlist-email">Email</label>
          <input id="waitlist-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" maxLength={254} required placeholder="voce@email.com"
            value={values.email} onChange={event => update("email", event.target.value)} onBlur={() => touch("email")}
            aria-invalid={emailError ? true : undefined} aria-describedby={describedBy(emailError && "waitlist-email-error")} />
          <FieldError id="waitlist-email-error" message={emailError} />
        </div>

        <div className={`lnd-waitlist-field${validClass("whatsapp")}`}>
          <label htmlFor="waitlist-whatsapp">WhatsApp <span className="lnd-waitlist-label-hint">(Brasil, +55, com DDD)</span></label>
          <div className="lnd-waitlist-phone">
            <span className="lnd-waitlist-phone-prefix" aria-hidden="true"><BrazilFlag />+55</span>
            <input id="waitlist-whatsapp" ref={phoneInput} name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" enterKeyHint="next" maxLength={25} required placeholder="(11) 99999-9999"
              value={values.whatsapp} onChange={onPhoneChange} onBlur={() => touch("whatsapp")}
              aria-invalid={phoneError ? true : undefined} aria-describedby={describedBy(phoneError && "waitlist-whatsapp-error", "waitlist-phone-help")} />
          </div>
          <FieldError id="waitlist-whatsapp-error" message={phoneError} />
          <small id="waitlist-phone-help">Usaremos este número somente se você autorizar abaixo.</small>
        </div>

        <fieldset className="lnd-waitlist-group" role="radiogroup" aria-labelledby="waitlist-plan" aria-required="true" aria-invalid={planError ? true : undefined} aria-describedby={describedBy(planError && "waitlist-plan-error")}>
          <legend id="waitlist-plan">Plano de interesse</legend>
          <div className="lnd-waitlist-plans">
            {choices.map(p => <label key={p.slug} className={`lnd-waitlist-plan-option${values.plan === p.slug ? " is-selected" : ""}`}>
              <input type="radio" name="planSlug" value={p.slug} className="lnd-waitlist-radio" checked={values.plan === p.slug}
                onChange={() => { update("plan", p.slug); touch("plan"); }} />
              <span className="lnd-waitlist-plan-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              <span className="lnd-waitlist-plan-name">{planShortName(p).replace(/^./, c => c.toUpperCase())}</span>
              <span className="lnd-waitlist-plan-period">{planLandingPeriod(p)}</span>
            </label>)}
          </div>
          <FieldError id="waitlist-plan-error" message={planError} />
        </fieldset>

        <div className="lnd-waitlist-honey" aria-hidden="true"><label>Não preencha<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

        <fieldset className="lnd-waitlist-group" aria-describedby={describedBy(consentError && "waitlist-consent-error")}>
          <legend>Como prefere receber novidades?</legend>
          <div className="lnd-waitlist-consents">
            <label className={values.emailConsent ? "is-checked" : undefined}><input id="waitlist-consent-email" type="checkbox" name="emailConsent" checked={values.emailConsent} aria-invalid={consentError ? true : undefined}
              onChange={event => { update("emailConsent", event.target.checked); touch("consent"); }} /> <span>Quero receber por email novidades e o aviso de abertura da pré-venda.</span></label>
            <label className={values.whatsappConsent ? "is-checked" : undefined}><input type="checkbox" name="whatsappConsent" checked={values.whatsappConsent} aria-invalid={consentError ? true : undefined}
              onChange={event => { update("whatsappConsent", event.target.checked); touch("consent"); }} /> <span>Quero receber pelo WhatsApp novidades e o aviso de abertura da pré-venda.</span></label>
          </div>
          <FieldError id="waitlist-consent-error" message={consentError} />
        </fieldset>

        <p className="lnd-waitlist-note">Enviaremos um email de confirmação do cadastro, separado das mensagens promocionais. Saiba como tratamos seus dados na <a href="/privacidade">Política de Privacidade</a>. Você pode retirar seu consentimento e se descadastrar.</p>
        <button type="submit" className="lnd-btn lnd-btn-primary lnd-btn-block lnd-waitlist-submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="lnd-waitlist-spinner" aria-hidden="true" />Registrando…</> : <>Quero entrar na lista de espera<ArrowRight size={18} aria-hidden="true" /></>}
        </button>
        <p className="lnd-waitlist-sr" role="status">{busy ? "Registrando seu cadastro…" : ""}</p>
      </fieldset></form>}
  </div></section>;
}
