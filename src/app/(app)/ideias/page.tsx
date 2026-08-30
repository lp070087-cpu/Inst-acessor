import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { aiConfigured } from "@/lib/ai";
import { listIdeas } from "@/lib/ai/services";
import { IdeasClient } from "@/components/ai/ideas-client";

export const metadata: Metadata = {
  title: "Central de Ideias",
  description: "Ideias de conteúdo baseadas no seu perfil real, para suas redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function IdeiasPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const configured = await aiConfigured();
  const ideas = configured ? await listIdeas(userId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Lightbulb size={26} className="text-purple" />
          Central de Ideias
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Ideias de conteúdo para o seu nicho, com base apenas nos dados reais do
          seu perfil. Nada de tendências inventadas.
        </p>
      </div>

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
