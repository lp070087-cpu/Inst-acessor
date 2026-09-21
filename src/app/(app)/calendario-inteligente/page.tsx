import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { getSmartCalendar } from "@/lib/planning/smart-calendar-db";
import { SmartCalendarClient } from "@/components/planning/smart-calendar-client";

export const metadata: Metadata = {
  title: "Calendário Inteligente",
  description:
    "Recomendações de calendário derivadas apenas de dados reais — sem dados, nenhuma recomendação é inventada.",
};

export const dynamic = "force-dynamic";

export default async function SmartCalendarPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Leitura real de: conteúdo planejado, publicações coletadas, snapshots e
  // metas. Nenhuma chamada à API da Meta e nenhuma escrita.
  const data = await getSmartCalendar(userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Sparkles size={26} className="text-purple" />
          Calendário Inteligente
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Recomendações de dia, formato e ritmo derivadas do seu histórico real. Quando
          não há dado suficiente, o Inst Acessor diz exatamente isso.
        </p>
      </div>

      <SmartCalendarClient data={data} />
    </div>
  );
}
