"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

import { useToast } from "@/components/ui/toast";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [keepConnected, setKeepConnected] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      // NOTA — "Manter conectado" (UI/state nesta rodada):
      // O NextAuth v4.24.7 deste projeto usa session.strategy = "jwt" e NÃO lê o campo
      // `maxAge` do corpo do POST (o servidor só lê callbackUrl/csrfToken). A duração da
      // sessão vem apenas de `session.maxAge` estático em src/lib/auth/config.ts, que hoje
      // usa o padrão de 30 dias (sessão persistente por padrão).
      // Portanto, o checkbox é apenas estado visual por enquanto: desmarcá-lo NÃO encurta a
      // sessão. Diferenciar 30d x 1d por login exige mudança estrutural (ex.: middleware
      // reemitindo token com maxAge por request, ou strategy de sessão em banco) — pendência
      // documentada. Nada de senha/usuário é armazenado no navegador.
    });

    setLoading(false);

    if (res?.error) {
      setError("E-mail ou senha inválidos.");
      toast("E-mail ou senha inválidos.", "error");
      return;
    }

    // redireciona direto para o app; o guard decide entre onboarding e dashboard
    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="lgn-form" noValidate>
      {error && (
        <div className="lgn-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="lgn-field lgn-in-1">
        <label htmlFor="email" className="lgn-label">
          E-mail
        </label>
        <div className="lgn-input-wrap">
          <span className="lgn-input-icon" aria-hidden="true">
            <Mail size={17} strokeWidth={1.8} />
          </span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="lgn-input"
            required
          />
        </div>
      </div>

      <div className="lgn-field lgn-in-2">
        <label htmlFor="password" className="lgn-label">
          Senha
        </label>
        <div className="lgn-input-wrap">
          <span className="lgn-input-icon" aria-hidden="true">
            <Lock size={17} strokeWidth={1.8} />
          </span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="lgn-input"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((v) => !v)}
            className="lgn-eye"
          >
            {showPassword ? (
              <EyeOff size={19} strokeWidth={1.8} />
            ) : (
              <Eye size={19} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <div className="lgn-row lgn-in-3">
        <label className="lgn-check">
          <input
            type="checkbox"
            checked={keepConnected}
            onChange={(e) => setKeepConnected(e.target.checked)}
          />
          <span className="lgn-box" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6.2 4.8 9 10 3.4"
                stroke="#1a0b28"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>Manter conectado</span>
        </label>

        <a href="/recuperar-senha" className="lgn-link">
          Esqueci minha senha
        </a>
      </div>

      <button
        type="submit"
        className="lgn-submit lgn-in-4"
        disabled={loading}
        aria-busy={loading}
      >
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Entrando..." : "Entrar"}
        {!loading && (
          <span className="lgn-arrow" aria-hidden="true">
            <ArrowRight size={19} strokeWidth={2.1} />
          </span>
        )}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
