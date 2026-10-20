"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_CLASS_FILLED } from "@/lib/ui/field";
import { loginSchema, registerSchema } from "@/lib/validators/auth";

const requestMessage = "Se a conta puder recuperar o acesso, enviaremos as instruções.";
const completeError = "Não foi possível redefinir a senha. Solicite um novo link e tente novamente.";
const passwordSchema = registerSchema.innerType().shape.password;

export function PasswordResetForm() {
  const [token, setToken] = React.useState<string | undefined>();
  const [ready, setReady] = React.useState(false);
  const initialized = React.useRef(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const errorElement = React.useRef<HTMLDivElement>(null);
  const successElement = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function readLocation() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const incoming = fragment.get("token") || url.searchParams.get("token") || undefined;
      // Fragment links never send the token in HTTP. Legacy query links are cleaned immediately.
      if (fragment.has("token") || url.searchParams.has("token")) {
        url.searchParams.delete("token");
        url.hash = "";
        window.history.replaceState(window.history.state, "", url.pathname + url.search);
      }
      setToken(incoming);
      setPassword(""); setConfirmation(""); setEmail(""); setError(null); setSuccess(false);
      setReady(true);
    }
    // React Strict Mode replays effects; do not replace a captured token with the cleaned URL.
    if (!initialized.current) { initialized.current = true; readLocation(); }
    window.addEventListener("hashchange", readLocation);
    return () => window.removeEventListener("hashchange", readLocation);
  }, []);

  React.useEffect(() => { if (success) successElement.current?.focus(); }, [success]);

  function showError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => errorElement.current?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading || success) return;
    setError(null);
    const parsedEmail = loginSchema.shape.email.safeParse(email.trim());
    if (!token && !parsedEmail.success) {
      showError("Informe um email válido."); return;
    }
    if (token) {
      const parsedPassword = passwordSchema.safeParse(password);
      if (!parsedPassword.success) { showError(parsedPassword.error.issues[0]?.message ?? "Verifique a nova senha."); return; }
      if (password !== confirmation) { showError("As senhas não coincidem."); return; }
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(token ? "/api/password-reset/complete" : "/api/password-reset/request", {
        method: "POST", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, password } : { email: parsedEmail.success ? parsedEmail.data : "" }),
      });
      if (!response.ok) {
        showError(response.status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." : token ? completeError : "Não foi possível concluir a solicitação. Tente novamente mais tarde.");
        return;
      }
      const result: { ok?: boolean } = await response.json();
      if (result.ok !== true) { showError(token ? completeError : "Não foi possível concluir a solicitação. Tente novamente mais tarde."); return; }
      if (token) window.history.replaceState(window.history.state, "", "/recuperar-senha");
      setPassword(""); setConfirmation(""); setEmail(""); setSuccess(true);
    } catch {
      showError("Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.");
    } finally { window.clearTimeout(timer); setLoading(false); }
  }

  if (!ready) return <p role="status" aria-live="polite" className="mt-6 text-sm text-ink-muted">Preparando formulário de recuperação...</p>;

  return <div className="mt-6 space-y-5">
    {token && !success && <div className="space-y-1"><h2 className="text-lg font-semibold text-ink">Defina sua nova senha</h2><p className="text-sm leading-6 text-ink-soft">O link é de uso único. Confirme a nova senha abaixo.</p></div>}
    {success ? <div ref={successElement} role="status" tabIndex={-1} className="rounded-xl border border-purple/20 bg-ai-soft p-4 text-sm leading-6 text-ink focus:outline-none focus:ring-2 focus:ring-purple/30">
      {token ? "Senha atualizada. Entre novamente com sua nova senha." : requestMessage}
    </div> : <form onSubmit={submit} noValidate aria-busy={loading} className="space-y-4">
      {error && <div ref={errorElement} id="reset-error" role="alert" tabIndex={-1} className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger focus:outline-none focus:ring-2 focus:ring-danger/30">{error}</div>}
      <fieldset disabled={loading} className="min-w-0 space-y-4 border-0 p-0">
        {token ? <>
          <div className="space-y-1.5"><label htmlFor="reset-password" className="text-sm font-semibold text-ink">Nova senha</label>
            <input id="reset-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "reset-password-help reset-error" : "reset-password-help"} className={FIELD_CLASS_FILLED} />
            <p id="reset-password-help" className="text-xs leading-5 text-ink-muted">Use no mínimo 8 caracteres.</p></div>
          <div className="space-y-1.5"><label htmlFor="reset-confirmation" className="text-sm font-semibold text-ink">Confirmar nova senha</label>
            <input id="reset-confirmation" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "reset-error" : undefined} className={FIELD_CLASS_FILLED} /></div>
        </> : <div className="space-y-1.5"><label htmlFor="reset-email" className="text-sm font-semibold text-ink">Email da conta</label>
          <input id="reset-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "reset-email-help reset-error" : "reset-email-help"} className={FIELD_CLASS_FILLED} />
          <p id="reset-email-help" className="text-xs leading-5 text-ink-muted">A resposta é a mesma para todos os endereços e não confirma a existência de uma conta nem a entrega do email.</p></div>}
        <Button type="submit" block disabled={loading} aria-busy={loading} className="whitespace-normal motion-reduce:transform-none motion-reduce:transition-none">
          {loading && <Loader2 size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          {loading ? "Processando..." : token ? "Salvar nova senha" : "Solicitar instruções"}
        </Button>
      </fieldset>
    </form>}
    <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
      <Link href="/login?from=landing" prefetch={false} className="rounded font-semibold text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple">Voltar ao login</Link>
      {token && <button type="button" disabled={loading} onClick={() => { setToken(undefined); setPassword(""); setConfirmation(""); setEmail(""); setError(null); setSuccess(false); window.requestAnimationFrame(() => document.getElementById("reset-email")?.focus()); }} className="rounded text-purple underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple disabled:opacity-50">Solicitar novo link</button>}
    </div>
  </div>;
}
