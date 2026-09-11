import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";

import { getSession } from "@/lib/auth/config";
import { getPlanById, getPlanBySlug, listPlans } from "@/lib/billing/plans";
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
 * Comprador já autenticado → sessão é a fonte de verdade (e-mail/nome).
 * Comprador anônimo → informa nome (opcional) + e-mail (obrigatório); o
 * e-mail vira a identidade que recebe o AccessGrant após pagamento validado.
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

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Checkout seguro
        </span>
      </div>
      <h1 className="font-display text-[24px] font-bold text-ink">
        {isAuthed ? "Assinar" : "Criar acesso"} —{" "}
        {plan.name.replace(/^Inst acessor\s*/i, "")}
      </h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5">
        {isAuthed
          ? "Confirme os dados e finalize o pagamento para ativar ou renovar seu acesso."
          : "Não é preciso ter conta. Após a confirmação do pagamento, você ativa seu acesso com este e-mail."}
      </p>

      <div className="mt-7">
        <CheckoutForm
          plan={plan}
          plans={plans}
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
