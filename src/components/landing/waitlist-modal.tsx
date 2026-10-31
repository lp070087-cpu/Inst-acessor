"use client";
/**
 * LISTA DE ESPERA — MODAL (desktop) / GAVETA INFERIOR (≤ 640px)
 * ==============================================================
 * Não existe mais formulário embutido na landing. Este componente fica montado
 * uma única vez na página e abre o diálogo quando:
 *   • qualquer link `href="#lista-de-espera"` (ou "/#lista-de-espera") é clicado
 *     — delegação no documento, então CTAs de qualquer seção funcionam;
 *   • `WaitlistPlanLink` é clicado (mesmo link, com `data-waitlist-plan`, que
 *     pré-seleciona o plano);
 *   • o evento `inst-waitlist-plan` é disparado (detail: slug ou { slug });
 *   • a página carrega com o hash `#lista-de-espera` (ex.: /lista-de-espera
 *     redireciona para /#lista-de-espera).
 *
 * Fluxo em 2 etapas (dados → preferências). O sucesso só aparece quando a API
 * responde HTTP 200 com `{ ok: true }`; aí o confete roda (exceto com
 * movimento reduzido).
 */
import * as React from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, MailCheck, X } from "lucide-react";
import { PLAN_CATALOG, planLandingPeriod, planShortName } from "@/lib/billing/plans/display";
import { applyBrazilianPhoneEdit, BRAZILIAN_PHONE_MESSAGES, brazilianPhoneDigits, brazilianPhoneProblem } from "@/lib/launch-waitlist/phone";
import { launchConfetti } from "./confetti";

export const WAITLIST_HASH = "#lista-de-espera";
export const WAITLIST_PLAN_EVENT = "inst-waitlist-plan";
export const WAITLIST_PLAN_ATTRIBUTE = "data-waitlist-plan";

const choices = ["semanal", "mensal", "anual"].map(slug => PLAN_CATALOG.find(plan => plan.slug === slug)!);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const REQUEST_TIMEOUT_MS = 15000;

type Step = 1 | 2 | "done";
type FieldKey = "name" | "email" | "whatsapp" | "plan" | "privacy";
type Values = { name: string; email: string; whatsapp: string; plan: string; emailConsent: boolean; whatsappConsent: boolean; privacyAccepted: boolean };
type Errors = Partial<Record<FieldKey, string>>;
const EMPTY: Values = { name: "", email: "", whatsapp: "", plan: "", emailConsent: false, whatsappConsent: false, privacyAccepted: false };
const STEP_FIELDS: Record<1 | 2, FieldKey[]> = { 1: ["name", "email", "whatsapp"], 2: ["plan", "privacy"] };
const FOCUS_TARGET: Record<FieldKey, string> = { name: "waitlist-name", email: "waitlist-email", whatsapp: "waitlist-whatsapp", plan: "waitlist-plan-semanal", privacy: "waitlist-privacy" };
const STEP_TITLE: Record<1 | 2, string> = { 1: "Seus dados", 2: "Suas preferências" };

function validate(values: Values): Errors {
  const errors: Errors = {};
  const name = values.name.trim(), email = values.email.trim();
  if (!name) errors.name = "Informe seu nome.";
  else if (name.length < 2) errors.name = "O nome precisa ter pelo menos 2 caracteres.";
  else if (name.length > 100) errors.name = "Use no máximo 100 caracteres.";
  if (!email) errors.email = "Informe seu e-mail.";
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = "Confira o e-mail. Exemplo: nome@dominio.com.br.";
  const phoneProblem = brazilianPhoneProblem(brazilianPhoneDigits(values.whatsapp));
  if (phoneProblem) errors.whatsapp = BRAZILIAN_PHONE_MESSAGES[phoneProblem];
  if (!choices.some(p => p.slug === values.plan)) errors.plan = "Escolha o plano de interesse.";
  if (!values.privacyAccepted) errors.privacy = "Para continuar, aceite a Política de Privacidade.";
  return errors;
}

const isPlan = (slug: unknown): slug is string => typeof slug === "string" && choices.some(p => p.slug === slug);

/** Link interno que aponta para a lista de espera nesta mesma página. */
function waitlistAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return null;
  const raw = anchor.getAttribute("href") ?? "";
  if (!raw.includes(WAITLIST_HASH)) return null;
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.hash === WAITLIST_HASH && url.origin === window.location.origin && url.pathname === window.location.pathname ? anchor : null;
  } catch { return null; }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="lnd-wl-error"><AlertCircle size={15} aria-hidden="true" /><span>{message}</span></p>;
}

function BrazilFlag() {
  return <svg className="lnd-wl-flag" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" focusable="false">
    <rect width="20" height="14" rx="2" fill="#009c3b" /><path d="M10 2 18 7l-8 5-8-5z" fill="#ffdf00" /><circle cx="10" cy="7" r="3" fill="#002776" />
  </svg>;
}

export function WaitlistModal() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>(1);
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [touched, setTouched] = React.useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = React.useState<{ 1: boolean; 2: boolean }>({ 1: false, 2: false });
  const [fromPlan, setFromPlan] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState<{ kind: "invalid" | "step" | "open"; n: number } | null>(null);

  const busyRef = React.useRef(false);
  const openRef = React.useRef(false);
  const stepRef = React.useRef<Step>(1);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const overlayPress = React.useRef(false);
  const feedbackRef = React.useRef<HTMLDivElement>(null);
  const doneHeading = React.useRef<HTMLHeadingElement>(null);
  const doneIcon = React.useRef<HTMLDivElement>(null);
  const phoneInput = React.useRef<HTMLInputElement>(null);
  const honeypot = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);
  const stopConfetti = React.useRef<() => void>(() => {});
  openRef.current = open;
  stepRef.current = step;

  const errors = validate(values);
  const currentStep: 1 | 2 = step === 2 ? 2 : 1;
  const visible = (key: FieldKey) => (attempted[currentStep] || touched[key]) ? errors[key] : undefined;
  const touch = (key: FieldKey) => setTouched(current => current[key] ? current : { ...current, [key]: true });
  const requestFocus = (kind: "invalid" | "step" | "open") => setFocusRequest(current => ({ kind, n: (current?.n ?? 0) + 1 }));

  const resetForm = React.useCallback(() => {
    setValues(EMPTY); setTouched({}); setAttempted({ 1: false, 2: false }); setFromPlan(false); setFormError(null); setStep(1);
  }, []);

  const openModal = React.useCallback((plan: string | null, trigger: Element | null) => {
    if (busyRef.current) return;
    triggerRef.current = trigger instanceof HTMLElement ? trigger : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (stepRef.current === "done") { setValues(EMPTY); setTouched({}); setAttempted({ 1: false, 2: false }); setFromPlan(false); }
    if (plan && isPlan(plan)) { setValues(current => ({ ...current, plan })); setFromPlan(true); }
    setFormError(null); setStep(1); setOpen(true); requestFocus("open");
  }, []);

  const closeModal = React.useCallback(() => {
    if (busyRef.current || !openRef.current) return;
    setOpen(false);
    if (stepRef.current === "done") resetForm();
    const trigger = triggerRef.current; triggerRef.current = null;
    // Depois do desmonte do diálogo, devolve o foco a quem o abriu.
    window.requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
  }, [resetForm]);

  // Gatilhos: delegação de links, evento customizado e hash na URL.
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = waitlistAnchor(event.target);
      if (!anchor) return;
      event.preventDefault();
      openModal(anchor.getAttribute(WAITLIST_PLAN_ATTRIBUTE), anchor);
    }
    function onPlanEvent(event: Event) {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      const slug = typeof detail === "string" ? detail : (detail && typeof detail === "object" && "slug" in detail ? (detail as { slug: unknown }).slug : null);
      openModal(isPlan(slug) ? slug : null, null);
    }
    function fromHash() {
      if (window.location.hash !== WAITLIST_HASH) return;
      // Limpa o hash para que fechar o diálogo não deixe a URL "presa" nele.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      openModal(null, null);
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener(WAITLIST_PLAN_EVENT, onPlanEvent);
    window.addEventListener("hashchange", fromHash);
    fromHash();
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(WAITLIST_PLAN_EVENT, onPlanEvent);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [openModal]);

  // Trava a rolagem do fundo enquanto o diálogo está aberto.
  React.useEffect(() => {
    if (!open) return;
    const html = document.documentElement, body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow, padding: body.style.paddingRight };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => { html.style.overflow = previous.html; body.style.overflow = previous.body; body.style.paddingRight = previous.padding; };
  }, [open]);

  // Esc fecha e Tab fica preso dentro do diálogo.
  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeModal(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (!dialog.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && (active === first || active === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    }
    function onFocusIn(event: FocusEvent) {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) dialog.focus({ preventScroll: true });
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("focusin", onFocusIn); };
  }, [open, closeModal]);

  // Foco: ao abrir, ao trocar de etapa e no primeiro campo inválido.
  React.useEffect(() => {
    if (!focusRequest || !open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (focusRequest.kind === "invalid") {
      const first = STEP_FIELDS[currentStep].find(key => document.getElementById(`waitlist-${key}-error`));
      if (!first) return;
      const target = first === "plan"
        ? (dialog.querySelector<HTMLInputElement>('input[name="planSlug"]:checked') ?? dialog.querySelector<HTMLInputElement>('input[name="planSlug"]'))
        : document.getElementById(FOCUS_TARGET[first]);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (focusRequest.kind === "open" && currentStep === 1 && window.matchMedia("(pointer: fine)").matches) {
      // Desktop: direto no primeiro campo. Toque: título, para não abrir o teclado por cima da gaveta.
      document.getElementById("waitlist-name")?.focus({ preventScroll: true });
      return;
    }
    document.getElementById("waitlist-step-title")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só a pedidos explícitos de foco.
  }, [focusRequest]);

  React.useEffect(() => { if (formError) feedbackRef.current?.focus(); }, [formError]);

  // Sucesso: foco no título e confete (o próprio módulo ignora movimento reduzido).
  React.useEffect(() => {
    if (step !== "done" || !open) return;
    doneHeading.current?.focus({ preventScroll: true });
    const box = doneIcon.current?.getBoundingClientRect();
    stopConfetti.current = launchConfetti(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
    return () => stopConfetti.current();
  }, [step, open]);

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

  function goBack() {
    if (busyRef.current) return;
    setFormError(null); setStep(1); requestFocus("step");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    setFormError(null);
    if (step === 1) {
      setAttempted(current => ({ ...current, 1: true }));
      if (STEP_FIELDS[1].some(key => errors[key])) { requestFocus("invalid"); return; }
      setStep(2); requestFocus("step"); return;
    }
    setAttempted(current => ({ ...current, 2: true }));
    if (STEP_FIELDS[1].some(key => errors[key])) { setStep(1); setAttempted(current => ({ ...current, 1: true })); requestFocus("invalid"); return; }
    if (STEP_FIELDS[2].some(key => errors[key])) { requestFocus("invalid"); return; }
    const payload = {
      name: values.name.trim(), email: values.email.trim(), whatsapp: `+55${brazilianPhoneDigits(values.whatsapp)}`, planSlug: values.plan,
      emailConsent: values.emailConsent, whatsappConsent: values.whatsappConsent, privacyAccepted: true as const,
      source: fromPlan ? "landing-plan" : "landing", website: honeypot.current?.value ?? "",
    };
    busyRef.current = true; setBusy(true);
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/launch-waitlist", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        setFormError(response.status === 429 ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
          : response.status === 400 ? "Não conseguimos validar os dados. Volte, confira os campos e tente novamente."
          : "Não foi possível registrar agora. Tente novamente em instantes.");
        return;
      }
      const result: unknown = await response.json().catch(() => null);
      if (!result || typeof result !== "object" || (result as { ok?: unknown }).ok !== true) {
        setFormError("Não foi possível concluir a solicitação. Tente novamente em instantes.");
        return;
      }
      setStep("done");
    } catch {
      setFormError(controller.signal.aborted
        ? "O servidor demorou demais para responder. Verifique sua conexão e tente novamente."
        : "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
    } finally { window.clearTimeout(timer); busyRef.current = false; setBusy(false); }
  }

  if (!open) return null;

  const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;
  const nameError = visible("name"), emailError = visible("email"), phoneError = visible("whatsapp"), planError = visible("plan"), privacyError = visible("privacy");
  const validClass = (key: FieldKey) => touched[key] && !errors[key] ? " is-valid" : "";
  const done = step === "done";

  return <div className="lnd-wl-overlay" data-busy={busy || undefined}
    onMouseDown={event => { overlayPress.current = event.target === event.currentTarget; }}
    onClick={event => { if (overlayPress.current && event.target === event.currentTarget) closeModal(); overlayPress.current = false; }}>
    <div ref={dialogRef} className={`lnd-wl-dialog${done ? " is-done" : ""}`} role="dialog" aria-modal="true" tabIndex={-1}
      aria-labelledby={done ? "waitlist-done-title" : "waitlist-dialog-title"} aria-describedby={done ? "waitlist-done-text" : "waitlist-dialog-desc"}>
      <span className="lnd-wl-handle" aria-hidden="true" />
      <button type="button" className="lnd-wl-close" onClick={closeModal} disabled={busy} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>

      {done ? <div className="lnd-wl-done">
        <div ref={doneIcon} className="lnd-wl-done-icon" aria-hidden="true"><Check size={30} strokeWidth={2.75} /></div>
        <h2 id="waitlist-done-title" ref={doneHeading} tabIndex={-1}><span aria-hidden="true">🎉 </span>Você está na lista!</h2>
        <p id="waitlist-done-text">Seu cadastro foi realizado com sucesso. Fique de olho nas novidades do Inst Acessor e na abertura dos planos. Avisaremos pelos canais que você autorizou.</p>
        <div className="lnd-wl-done-note"><MailCheck size={18} aria-hidden="true" /><p>Enviaremos um e-mail para confirmar o cadastro. Se não encontrar, confira as pastas de spam e promoções.</p></div>
        <button type="button" className="lnd-btn lnd-btn-primary lnd-btn-block lnd-wl-done-btn" onClick={closeModal}>Voltar ao site</button>
      </div>

      : <form className="lnd-wl-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
        <header className="lnd-wl-head">
          <p className="lnd-wl-eyebrow">Antes do lançamento</p>
          <h2 id="waitlist-dialog-title">Entre na lista de espera</h2>
          <p id="waitlist-dialog-desc" className="lnd-wl-sub">Sem pagamento e sem criar conta. Leva menos de um minuto.</p>
          <div className="lnd-wl-progress">
            <div className="lnd-wl-progress-bar" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={1} aria-valuemax={2} aria-valuenow={currentStep} aria-valuetext={`Etapa ${currentStep} de 2: ${STEP_TITLE[currentStep]}`}>
              <span className="is-on" /><span className={currentStep === 2 ? "is-on" : undefined} />
            </div>
            <p className="lnd-wl-progress-label">Etapa {currentStep} de 2</p>
          </div>
        </header>

        <div className="lnd-wl-body">
          <h3 id="waitlist-step-title" className="lnd-wl-step-title" tabIndex={-1}>{STEP_TITLE[currentStep]}</h3>
          {formError && <div ref={feedbackRef} tabIndex={-1} role="alert" className="lnd-wl-feedback"><AlertCircle size={18} aria-hidden="true" /><span>{formError}</span></div>}

          <fieldset className="lnd-wl-fields" disabled={busy}>
            {currentStep === 1 ? <>
              <div className={`lnd-wl-field${validClass("name")}`}>
                <label htmlFor="waitlist-name">Nome</label>
                <input id="waitlist-name" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" maxLength={100} required placeholder="Como podemos te chamar?"
                  value={values.name} onChange={event => update("name", event.target.value)} onBlur={() => touch("name")}
                  aria-invalid={nameError ? true : undefined} aria-describedby={describedBy(nameError && "waitlist-name-error")} />
                <FieldError id="waitlist-name-error" message={nameError} />
              </div>

              <div className={`lnd-wl-field${validClass("email")}`}>
                <label htmlFor="waitlist-email">E-mail</label>
                <input id="waitlist-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" maxLength={254} required placeholder="voce@email.com"
                  value={values.email} onChange={event => update("email", event.target.value)} onBlur={() => touch("email")}
                  aria-invalid={emailError ? true : undefined} aria-describedby={describedBy(emailError && "waitlist-email-error")} />
                <FieldError id="waitlist-email-error" message={emailError} />
              </div>

              <div className={`lnd-wl-field${validClass("whatsapp")}`}>
                <label htmlFor="waitlist-whatsapp">WhatsApp <span className="lnd-wl-hint">(com DDD)</span></label>
                <div className="lnd-wl-phone">
                  <span className="lnd-wl-phone-prefix" aria-hidden="true"><BrazilFlag />+55</span>
                  <input id="waitlist-whatsapp" ref={phoneInput} name="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" enterKeyHint="done" maxLength={25} required placeholder="(11) 99999-9999"
                    value={values.whatsapp} onChange={onPhoneChange} onBlur={() => touch("whatsapp")}
                    aria-invalid={phoneError ? true : undefined} aria-describedby={describedBy(phoneError && "waitlist-whatsapp-error", "waitlist-phone-help")} />
                </div>
                <FieldError id="waitlist-whatsapp-error" message={phoneError} />
                <small id="waitlist-phone-help" className="lnd-wl-help">Número do Brasil (+55). Só enviaremos mensagens se você autorizar na próxima etapa.</small>
              </div>
            </> : <>
              <fieldset className="lnd-wl-group" role="radiogroup" aria-labelledby="waitlist-plan-legend" aria-required="true" aria-invalid={planError ? true : undefined} aria-describedby={describedBy(planError && "waitlist-plan-error")}>
                <legend id="waitlist-plan-legend">Plano de interesse</legend>
                <div className="lnd-wl-plans">
                  {choices.map(p => <label key={p.slug} className={`lnd-wl-plan${values.plan === p.slug ? " is-selected" : ""}`}>
                    <input id={`waitlist-plan-${p.slug}`} type="radio" name="planSlug" value={p.slug} className="lnd-wl-radio" checked={values.plan === p.slug}
                      onChange={() => { update("plan", p.slug); touch("plan"); }} />
                    <span className="lnd-wl-plan-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                    <span className="lnd-wl-plan-name">{planShortName(p).replace(/^./, c => c.toUpperCase())}</span>
                    <span className="lnd-wl-plan-period">{planLandingPeriod(p)}</span>
                  </label>)}
                </div>
                <FieldError id="waitlist-plan-error" message={planError} />
              </fieldset>

              <fieldset className="lnd-wl-group">
                <legend>Como prefere receber novidades? <span className="lnd-wl-hint">(opcional)</span></legend>
                <div className="lnd-wl-checks">
                  <label className={`lnd-wl-check${values.emailConsent ? " is-checked" : ""}`}><input type="checkbox" name="emailConsent" checked={values.emailConsent}
                    onChange={event => update("emailConsent", event.target.checked)} /> <span>Quero receber novidades e o aviso de abertura por e-mail.</span></label>
                  <label className={`lnd-wl-check${values.whatsappConsent ? " is-checked" : ""}`}><input type="checkbox" name="whatsappConsent" checked={values.whatsappConsent}
                    onChange={event => update("whatsappConsent", event.target.checked)} /> <span>Quero receber novidades e o aviso de abertura pelo WhatsApp.</span></label>
                </div>
              </fieldset>

              <div className="lnd-wl-privacy">
                <label className={`lnd-wl-check lnd-wl-check-required${values.privacyAccepted ? " is-checked" : ""}`}>
                  <input id="waitlist-privacy" type="checkbox" name="privacyAccepted" checked={values.privacyAccepted} required aria-required="true"
                    aria-invalid={privacyError ? true : undefined} aria-describedby={describedBy(privacyError && "waitlist-privacy-error")}
                    onChange={event => { update("privacyAccepted", event.target.checked); touch("privacy"); }} />
                  <span>Li e aceito a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
                </label>
                <FieldError id="waitlist-privacy-error" message={privacyError} />
              </div>
              <p className="lnd-wl-note">Você pode retirar seus consentimentos e se descadastrar a qualquer momento. A inscrição não reserva compra nem garante desconto.</p>
            </>}
            <div className="lnd-wl-honey" aria-hidden="true"><label>Não preencha<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
          </fieldset>
        </div>

        <div className="lnd-wl-actions">
          {currentStep === 2 && <button type="button" className="lnd-btn lnd-btn-ghost lnd-wl-back" onClick={goBack} disabled={busy}><ArrowLeft size={18} aria-hidden="true" />Voltar</button>}
          {currentStep === 1
            ? <button type="submit" className="lnd-btn lnd-btn-primary lnd-wl-next">Continuar<ArrowRight size={18} aria-hidden="true" /></button>
            : <button type="submit" className="lnd-btn lnd-btn-primary lnd-wl-next lnd-wl-submit" disabled={busy}>
              {busy ? <><Loader2 size={18} className="lnd-wl-spinner" aria-hidden="true" />Enviando…</> : <>Entrar na lista<ArrowRight size={18} aria-hidden="true" /></>}
            </button>}
          <p className="lnd-wl-sr" role="status">{busy ? "Enviando seu cadastro…" : ""}</p>
        </div>
      </form>}
    </div>
  </div>;
}
