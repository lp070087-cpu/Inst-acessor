import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listIdeas } from "@/lib/ai/services";
import { PageHeader } from "@/components/layout/page-header";
import { IdeasClient } from "@/components/ai/ideas-client";

export const metadata: Metadata = {
  title: "Central de Ideias",
  description: "Ideias de conteúdo baseadas no seu perfil real, para suas redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function IdeiasPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const configured = await aiConfigured();
  const ideas = configured ? await listIdeas(userId) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Lightbulb}
        title="Central de Ideias"
        description="Ideias de conteúdo para o seu nicho, com base apenas nos dados reais do seu perfil. Nada de tendências inventadas."
      />

      <IdeasClient
        aiConfigured={configured}
        initialIdeas={ideas.map((i) => ({
          id: i.id,
          category: i.category,
          title: i.title,
          format: i.format ?? "",
          objective: i.objective ?? "",
          context: i.context ?? "",
          rationale: i.rationale ?? "",
          status: i.status,
          platform: i.platform ?? "",
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
