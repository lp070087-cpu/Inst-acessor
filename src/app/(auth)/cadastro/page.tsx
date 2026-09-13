import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta no Inst Acessor e comece a crescer no Instagram.",
};

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <h1 className="font-display text-[24px] font-bold text-ink">
        Crie sua conta
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        Comece a transformar suas métricas em estratégia.
      </p>

      <div className="mt-7">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-soft">
        Já tem conta?{" "}
        <a href="/login" className="font-semibold text-purple hover:text-indigo">
          Entrar
        </a>
      </p>
    </div>
  );
}
