import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { runAnalysis } from "@/lib/ai/services";
import { getOpportunities } from "@/lib/ai/opportunities";
import { PageHeader } from "@/components/layout/page-header";
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

  // Carrega os dois perfis com dados reais dos snapshots, e as oportunidades
  // derivadas dos MESMOS dados (sempre escopadas por userId). Nada é inventado.
  const [instagram, tiktok, opportunities] = await Promise.all([
    runAnalysis(userId, "instagram", "30d"),
    runAnalysis(userId, "tiktok", "30d"),
    getOpportunities(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title="Análise de Desempenho"
        description="Métricas reais dos seus perfis, por período. Nada é estimado."
      />

      <AnaliseClient initialData={{ instagram, tiktok }} opportunities={opportunities} />
    </div>
  );
}
