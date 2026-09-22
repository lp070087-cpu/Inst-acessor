import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listPlans, getMySubscription, listMySubscriptions, getAccessStatus } from "@/lib/billing";
import { getPlanPromoDisplay } from "@/lib/billing/promo-db";
import { AssinaturaClient } from "@/components/billing/assinatura-client";

export const metadata: Metadata = {
  title: "Minha Assinatura",
  description: "Gerencie seu plano, cobrança e acesso do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // A pré-venda é lida AQUI, no servidor, junto com os planos: os cards de
  // "Minha Assinatura" anunciam o mesmo desconto que o checkout vai aplicar.
  // Antes, esta tela mostrava apenas o preço de catálogo — o cliente via
  // R$ 27,00 no card e era cobrado R$ 11,90 (ou o contrário, ao vencer o
  // prazo). A landing e o checkout já liam esta mesma configuração.
  const [plans, current, history, access, promo] = await Promise.all([
    listPlans(),
    getMySubscription(userId),
    listMySubscriptions(userId),
    getAccessStatus(userId),
    getPlanPromoDisplay(),
  ]);

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
        promo={promo}
      />
    </div>
  );
}
