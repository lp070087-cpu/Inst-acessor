import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listPlans, getMySubscription, listMySubscriptions, getAccessStatus } from "@/lib/billing";
import { isAsaasConfigured, asaasEnvironmentLabel } from "@/lib/billing/asaas/config";
import { AssinaturaClient } from "@/components/billing/assinatura-client";

export const metadata: Metadata = {
  title: "Minha Assinatura",
  description: "Gerencie seu plano, cobrança e acesso do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const [plans, current, history, access] = await Promise.all([
    listPlans(),
    getMySubscription(userId),
    listMySubscriptions(userId),
    getAccessStatus(userId),
  ]);

  // Estado REAL da integração (sem revelar valores/chaves) — apenas para a UI
  // escolher a mensagem correta ("em configuração" vs "aguardando pagamento").
  const billingConfigured = isAsaasConfigured();
  const billingLabel = billingConfigured ? asaasEnvironmentLabel() : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <CreditCard size={26} className="text-purple" />
          Minha Assinatura
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Uma assinatura. Duas redes. Uma inteligência trabalhando no seu crescimento.
        </p>
      </div>

      <AssinaturaClient
        initialPlans={plans}
        initialCurrent={current}
        initialHistory={history}
        initialAccess={access}
        billingConfigured={billingConfigured}
        billingLabel={billingLabel}
      />
    </div>
  );
}
