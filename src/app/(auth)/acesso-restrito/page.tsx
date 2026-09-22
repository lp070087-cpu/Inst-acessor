import type { Metadata } from "next";
import { Lock, RefreshCcw, Check } from "lucide-react";

import { requireSession } from "@/lib/auth/guard";
import { resolvePremiumAccess } from "@/lib/access/premium";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Acesso restrito ao plano",
  description: "Escolha um plano para liberar os módulos do Inst Acessor.",
};

export const dynamic = "force-dynamic";

/**
 * TELA DE ACESSO RESTRITO — para quem tem CONTA mas não tem DIREITO DE ACESSO.
 *
 * Por que existe separada de /expirado: são situações diferentes. Quem expirou
 * já teve acesso e precisa renovar; quem nunca teve plano não "expirou" — só
 * ainda não assinou. Mandar os dois para a mesma tela ("Seu acesso expirou")
 * contava uma história falsa para a conta gratuita.
 *
 * O usuário continua autenticado e mantém o Perfil, a Minha Assinatura e as
 * Configurações — nada é apagado. Só os módulos do plano ficam bloqueados.
 */
export default async function AcessoRestritoPage() {
  const session = await requireSession();
  const access = await resolvePremiumAccess(session.user.id);

  // Já tem acesso (ex.: pagou enquanto estava aqui) → volta para o app.
  // O ADMIN também cai neste caso e nunca vê esta tela.
  if (access.hasAccess) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  const expired = access.reason === "EXPIRED";
  const canceled = access.reason === "CANCELED";

  const title = expired
    ? "Seu período terminou"
    : canceled
      ? "Seu acesso foi cancelado"
      : "Sua conta ainda não tem um plano ativo";

  const body = expired
    ? "O período do seu plano chegou ao fim. Seus dados, seu perfil e seu histórico continuam salvos — basta renovar para voltar de onde parou."
    : canceled
      ? "O acesso foi cancelado. Nada foi apagado: seus dados continuam aqui e podem ser reativados a qualquer momento."
      : "Sua conta no Inst Acessor está criada e funcionando. Os módulos de inteligência (IA, Score, Rank, Calendário Inteligente, Respostas) fazem parte dos planos pagos — escolha um plano para liberá-los.";

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="grid w-16 h-16 place-items-center rounded-[22px] bg-ai-soft text-purple mb-4">
          <Lock size={30} strokeWidth={1.6} />
        </span>

        <h1 className="font-display text-[24px] font-bold text-ink">{title}</h1>

        <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[400px] mt-2">
          {body}
        </p>

        <ul className="mt-6 w-full max-w-[360px] flex flex-col gap-2 text-left">
          {[
            "IA Acessor, Ideias e Preview Social",
            "Score Inteligente, Rank e Metas",
            "Calendário Inteligente e Análise de Desempenho",
            "Respostas Inteligentes nos comentários",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-soft">
              <Check size={15} className="text-success flex-none mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 w-full max-w-[340px]">
          <a href="/assinatura" className="block">
            <Button size="lg" block>
              <RefreshCcw size={17} />
              {expired || canceled ? "Renovar acesso" : "Ver planos"}
            </Button>
          </a>
        </div>

        <p className="mt-4 text-[12.5px] text-ink-muted">
          Seu perfil, suas redes conectadas e suas configurações continuam salvos.
        </p>
      </div>
    </div>
  );
}
