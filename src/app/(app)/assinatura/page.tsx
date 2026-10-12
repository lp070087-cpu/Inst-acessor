import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { listPlans, getMySubscription, listMySubscriptions, getAccessStatus } from "@/lib/billing";
import { getPlanPromoDisplay } from "@/lib/billing/promo-db";
import { getUsageSummary, listUsageHistory } from "@/lib/billing/usage/meter";
import { LIMITS_ENFORCEMENT_ENABLED } from "@/lib/billing/plans/limits";
import { PageHeader } from "@/components/layout/page-header";
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
  const [plans, current, history, access, promo, usage, usageHistory] = await Promise.all([
    listPlans(),
    getMySubscription(userId),
    listMySubscriptions(userId),
    getAccessStatus(userId),
    getPlanPromoDisplay(),
    // Consumo real do próprio usuário, lido no SERVIDOR (o navegador só exibe).
    // Se a leitura falhar, `getUsageSummary` degrada com estado vazio honesto —
    // nunca inventamos números de uso.
    getUsageSummary(userId).catch(() => null),
    // Histórico (log de auditoria), também no SERVIDOR e escopado por usuário.
    // Sem registros → lista vazia; o painel mostra o estado vazio honesto.
    listUsageHistory(userId).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CreditCard}
        title="Minha Assinatura"
        description="Uma assinatura. Duas redes. Uma inteligência trabalhando no seu crescimento."
      />

      <AssinaturaClient
        initialPlans={plans}
        initialCurrent={current}
        initialHistory={history}
        initialAccess={access}
        promo={promo}
        initialUsage={usage}
        initialUsageHistory={usageHistory}
        limitsEnforcementEnabled={LIMITS_ENFORCEMENT_ENABLED}
      />
    </div>
  );
}
