import type { Metadata } from "next";
import { Clock, RefreshCcw } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { getActiveAccessForUser } from "@/lib/first-access";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Seu acesso expirou",
  description: "Renove seu acesso ao Inst Acessor para continuar.",
};

/**
 * TELA DE EXPIRAÇÃO — acessível a usuários autenticados cujo acesso
 * terminou/cancelou. NUNCA deleta o User; apenas oferece renovação.
 */
export default async function ExpiradoPage() {
  const session = await requireSession();
  const access = await getActiveAccessForUser(session.user.id);

  // Se o acesso voltou a ficar ativo (ex.: renovação), sai da tela.
  if (access.active) {
    // import dinâmico para evitar ciclo; basta redirecionar:
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="grid w-16 h-16 place-items-center rounded-[22px] bg-danger/10 text-danger mb-4">
          <Clock size={30} strokeWidth={1.6} />
        </span>
        <h1 className="font-display text-[24px] font-bold text-ink">
          Seu acesso expirou
        </h1>
        <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[360px] mt-2">
          O período do seu plano chegou ao fim. Seus dados e seu perfil continuam
          salvos — basta renovar para continuar de onde parou.
        </p>

        <div className="mt-6 w-full max-w-[320px]">
          <a href="/assinatura" className="block">
            <Button size="lg" block>
              <RefreshCcw size={17} /> Renovar acesso
            </Button>
          </a>
        </div>

        <p className="mt-4 text-[12.5px] text-ink-muted">
          Precisando de ajuda? Fale conosco.
        </p>
      </div>
    </div>
  );
}
