import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";

import { getSession } from "@/lib/auth/config";
import {
  getPlanById,
  getPlanBySlug,
  listPlans,
  planShortName,
} from "@/lib/billing/plans";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Finalize sua assinatura do Inst Acessor com pagamento seguro via Asaas.",
};

export const dynamic = "force-dynamic";

/**
 * CHECKOUT PÚBLICO — página /checkout?plano=<slug> (SEM login necessário)
 * =========================================================================
 * Os CTAs da landing (/checkout?plano=semanal|mensal|anual) caem aqui.
 *
 * O plano é resolvido NO SERVIDOR (getPlanById/getPlanBySlug → catálogo
 * oficial). Preço/duração/ciclo nunca vêm do navegador. O formulário abre o
 * checkout hospedado do Asaas (POST /v3/checkouts) em nova aba.
 *
 * Dois cenários, decididos AQUI no servidor (fonte única):
 *
 *   A) COM sessão válida → e-mail/nome vêm da sessão (fonte de verdade) e o
 *      formulário informa que a compra será vinculada àquela conta.
 *   B) SEM sessão → NENHUM e-mail é exibido e nenhuma frase de "compra
 *      vinculada à sua conta" aparece. O visitante informa o e-mail que
 *      receberá o acesso (identidade do AccessGrant após pagamento validado).
 *      A lista de planos alternativos é esvaziada de propósito para que o
 *      formulário nem sequer possa cair no ramo autenticado.
 *
 * Shell visual próprio (src/app/checkout/layout.tsx), FORA do route group
 * autenticado e FORA do matcher do middleware — página pública.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: { plano?: string; planId?: string };
}) {
  const raw = searchParams?.planId ?? searchParams?.plano ?? "";

  const [session, plans] = await Promise.all([getSession(), listPlans()]);
  const authedEmail = session?.user?.email ?? null;
  const authedName = session?.user?.name ?? null;

  // Resolve o plano pedido (id do banco OU slug — ambos aceitos).
  const plan = raw
    ? ((await getPlanById(raw)) ?? (await getPlanBySlug(raw)))
    : null;
  if (!plan || !plan.active) notFound();

  const isAuthed = Boolean(authedEmail);
  const planShort = planShortName(plan);

  // "Compra vinculada à conta" só pode existir quando existe conta AQUI, AGORA.
  // Para isso ser estrutural (e não depender de o formulário lembrar de checar
  // `authedEmail` em cada ramo), o seletor de planos é esvaziado quando não há
  // sessão: o Cenário B passa a ter um único caminho de UI possível, sempre
  // com o campo de e-mail visível e vazio.
  const activePlans = isAuthed ? plans : [];

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Checkout seguro
        </span>
      </div>
      <h1 className="font-display text-[24px] font-bold text-ink">
        {isAuthed ? "Assinar" : "Criar acesso"} —{" "}
        {planShort}
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        {isAuthed
          ? "Confirme os dados e finalize o pagamento para ativar ou renovar seu acesso."
          : "Não é preciso ter conta. Após a confirmação do pagamento, você ativa seu acesso com este e-mail."}
      </p>

      <div className="mt-7">
        <CheckoutForm
          plan={plan}
          activePlans={activePlans}
          authedEmail={authedEmail}
          authedName={authedName}
        />
      </div>

      <div className="mt-6 pt-5 border-t border-border-soft flex flex-col gap-3">
        <div className="flex items-start gap-2.5 text-[12px] text-ink-muted">
          <ShieldCheck size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-success" />
          <span>
            Pagamento 100% seguro processado pelo Asaas. Nenhum dado financeiro é
            armazenado pelo Inst Acessor.
          </span>
        </div>
        <div className="flex items-start gap-2.5 text-[12px] text-ink-muted">
          <Sparkles size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-purple" />
          <span>
            Acesso liberado automaticamente após a confirmação do pagamento. Em caso de
            dúvida, use o e-mail da compra na página de primeiro acesso.
          </span>
        </div>
      </div>
    </div>
  );
}
