import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta no Inst Acessor.",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-8">
      <h1 className="font-display text-[24px] font-bold text-ink">
        Bem-vindo de volta
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        Entre para acompanhar a evolução do seu Instagram.
      </p>

      <div className="mt-7">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-soft">
        Ainda não tem conta?{" "}
        <a href="/cadastro" className="font-semibold text-purple hover:text-indigo">
          Criar conta
        </a>
      </p>
    </div>
  );
}
