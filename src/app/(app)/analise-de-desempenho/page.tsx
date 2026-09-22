import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { runAnalysis } from "@/lib/ai/services";
import { AnaliseClient } from "@/components/ai/analise-client";

export const metadata: Metadata = {
  title: "Análise de Desempenho",
  description: "Métricas, evolução e melhores momentos do seu Instagram e TikTok.",
};

export const dynamic = "force-dynamic";

export default async function AnaliseDesempenhoPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Carrega os dois perfis com dados reais dos snapshots.
  const [instagram, tiktok] = await Promise.all([
    runAnalysis(userId, "instagram", "30d"),
    runAnalysis(userId, "tiktok", "30d"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <BarChart3 size={26} className="text-purple" />
          Análise de Desempenho
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Métricas reais dos seus perfis, por período. Nada é estimado.
        </p>
      </div>

      <AnaliseClient initialData={{ instagram, tiktok }} />
    </div>
  );
}
