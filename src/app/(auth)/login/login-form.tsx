"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
    });

    setLoading(false);

    if (res?.error) {
      setError("E-mail ou senha inválidos.");
      toast("E-mail ou senha inválidos.", "error");
      return;
    }

    // redireciona direto para o app; o guard decide entre onboarding e dashboard
    const callbackUrl = searchParams.get("callbackUrl") ?? "/app/dashboard";
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
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
          required
        />
      </div>

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
