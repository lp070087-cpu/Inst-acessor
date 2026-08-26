"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <div className="rounded-[12px] bg-danger-softStrong border border-danger/20 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[13px] font-semibold text-ink"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className="h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-[13px] font-semibold text-ink"
          >
            Senha
          </label>
          <a
            href="/login"
            className="text-[12.5px] text-ink-soft hover:text-purple transition-colors"
          >
            Esqueci minha senha
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 w-full rounded-[12px] border border-border bg-bg-ice pr-12 pl-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-ink-soft hover:text-purple transition-colors cursor-pointer"
          >
            {showPassword ? (
              <EyeOff size={19} strokeWidth={1.8} />
            ) : (
              <Eye size={19} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 select-none">
        <span className="relative grid place-items-center">
          <input
            type="checkbox"
            checked={keepConnected}
            onChange={(e) => setKeepConnected(e.target.checked)}
            className="peer h-[18px] w-[18px] appearance-none rounded-[6px] border border-border bg-bg-ice transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple/20 checked:border-purple checked:bg-purple"
          />
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            className="pointer-events-none absolute hidden peer-checked:block text-white"
            aria-hidden="true"
          >
            <path
              d="M2 6.2 4.8 9 10 3.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[13px] text-ink-soft">Manter conectado</span>
      </label>

      <Button type="submit" size="lg" block disabled={loading}>
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Entrando..." : "Entrar"}
      </Button>
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
