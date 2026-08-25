"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error) {
          setErrors({ form: data.error });
        } else if (data.error) {
          setErrors({ form: data.error });
        }
        toast(data.error ?? "Não foi possível criar sua conta.", "error");
        return;
      }

      // Login automático após cadastro
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push("/login");
        return;
      }

      toast("Conta criada com sucesso! Vamos montar seu perfil.");
      router.push("/onboarding");
      router.refresh();
    } catch {
      setErrors({ form: "Não foi possível criar sua conta. Tente novamente." });
      toast("Não foi possível criar sua conta.", "error");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";
  const errText = "text-[12px] text-danger mt-1";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {errors.form && (
        <div className="rounded-[12px] bg-danger-softStrong border border-danger/20 px-4 py-3 text-[13px] text-danger">
          {errors.form}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-[13px] font-semibold text-ink">
          Nome
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className={field}
          required
        />
        {errors.name && <p className={errText}>{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold text-ink">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className={field}
          required
        />
        {errors.email && <p className={errText}>{errors.email}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[13px] font-semibold text-ink">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 8 caracteres"
            className={field}
            required
          />
          {errors.password && <p className={errText}>{errors.password}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-[13px] font-semibold text-ink"
          >
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a senha"
            className={field}
            required
          />
          {errors.confirmPassword && (
            <p className={errText}>{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      <Button type="submit" size="lg" block disabled={loading}>
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
