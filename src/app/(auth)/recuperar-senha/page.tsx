import type { Metadata } from "next";
import { PasswordResetForm } from "./password-reset-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Solicite instruções para recuperar o acesso ao Inst Acessor.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PasswordResetPage() {
  return <section className="min-w-0 rounded-xl border border-border-soft bg-card p-6 shadow-lg sm:p-8" aria-labelledby="reset-title">
    <h1 id="reset-title" className="text-2xl font-bold text-ink">Recuperar senha</h1>
    <p className="mt-2 text-sm leading-6 text-ink-soft">Solicite instruções ou use seu link de recuperação para definir uma nova senha.</p>
    <PasswordResetForm />
  </section>;
}
