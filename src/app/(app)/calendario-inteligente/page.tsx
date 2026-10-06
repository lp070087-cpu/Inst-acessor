import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { getSmartCalendar } from "@/lib/planning/smart-calendar-db";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleTabs, CALENDAR_MODULE_TABS } from "@/components/layout/module-tabs";
import { SmartCalendarClient } from "@/components/planning/smart-calendar-client";

export const metadata: Metadata = {
  title: "Calendário Inteligente",
  description:
    "Recomendações de calendário derivadas apenas de dados reais — sem dados, nenhuma recomendação é inventada.",
};

export const dynamic = "force-dynamic";

export default async function SmartCalendarPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Leitura real de: conteúdo planejado, publicações coletadas, snapshots e
  // metas. Nenhuma chamada à API da Meta e nenhuma escrita.
  const data = await getSmartCalendar(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Sparkles}
        title="Calendário Inteligente"
        description="Recomendações de dia, formato e ritmo derivadas do seu histórico real. Quando não há dado suficiente, o Inst Acessor diz exatamente isso."
      />

      <ModuleTabs tabs={CALENDAR_MODULE_TABS} />

      <SmartCalendarClient data={data} />
    </div>
  );
}
