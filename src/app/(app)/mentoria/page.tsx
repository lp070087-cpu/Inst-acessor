import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { listRecommendations } from "@/lib/ai/services";
import { MentoriaClient } from "@/components/ai/mentoria-client";

export const metadata: Metadata = {
  title: "Mentoria",
  description: "Recomendações personalizadas a partir do diagnóstico real do seu perfil.",
};

export const dynamic = "force-dynamic";

export default async function MentoriaPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const cards = await listRecommendations(userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <GraduationCap size={26} className="text-purple" />
          Mentoria
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Recomendações com base no seu diagnóstico real — métricas e estrutura.
          Sem conhecimento proprietário inventado.
        </p>
      </div>

      <MentoriaClient
        initialCards={cards.map((c) => ({
          id: c.id,
          category: c.category,
          label: c.label,
          priority: c.priority,
          problem: c.problem,
          explanation: c.explanation,
          action: c.action,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
