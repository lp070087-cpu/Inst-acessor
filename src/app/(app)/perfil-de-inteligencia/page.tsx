import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { getAIProfile } from "@/lib/ai/services";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleTabs, INTELLIGENCE_MODULE_TABS } from "@/components/layout/module-tabs";
import { PerfilInteligenciaClient } from "@/components/ai/perfil-inteligencia-client";

export const metadata: Metadata = {
  title: "Perfil de Inteligência",
  description: "O que a IA Acessor aprendeu sobre você até agora.",
};

export const dynamic = "force-dynamic";

export default async function PerfilInteligenciaPage() {
  // Módulo do plano: sem acesso premium, a própria página manda o usuário
  // para /acesso-restrito. A checagem vive na página (e não no layout)
  // porque só ela sabe a própria rota: não há header para ler nem um
  // valor que possa se perder no caminho.
  await requirePremiumPage();

  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const profile = await getAIProfile(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BrainCircuit}
        title="Perfil de Inteligência"
        description="O que a IA Acessor aprendeu sobre você, com base apenas em dados reais."
      />

      <ModuleTabs tabs={INTELLIGENCE_MODULE_TABS} />

      <PerfilInteligenciaClient
        profile={
          profile
            ? {
                id: profile.id,
                summary: profile.summary ?? "",
                niche: profile.niche ?? "",
                subNiche: profile.subNiche ?? "",
                objectives: profile.objectives ?? "",
                communicationStyle: profile.communicationStyle ?? "",
                observedPatterns: profile.observedPatterns ?? "",
                preferredFormats: profile.preferredFormats ?? "",
                ctaPatterns: profile.ctaPatterns ?? "",
                hookPatterns: profile.hookPatterns ?? "",
                postingFrequency: profile.postingFrequency ?? "",
                voiceTone: profile.voiceTone ?? "",
                writingStyle: profile.writingStyle ?? "",
                notes: profile.notes ?? "",
                updatedAt: profile.updatedAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}
