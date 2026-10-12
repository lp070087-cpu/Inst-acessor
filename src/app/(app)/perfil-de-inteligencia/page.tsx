import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import {
  requireOnboardedSession,
  requirePremiumPage,
} from "@/lib/auth/guard";
import { getLearnedProfile } from "@/lib/ai/services";
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

  // "A IA aprendeu sobre você": monta os cards a partir de dados REAIS do
  // usuário (AIProfile + padrões observados persistidos + frequência das
  // publicações coletadas). Campos sem fonte de dado aparecem com estado
  // honesto de "ainda não temos dados" — nunca com valor inventado.
  const learned = await getLearnedProfile(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BrainCircuit}
        title="Perfil de Inteligência"
        description="O que a IA Acessor aprendeu sobre você, com base apenas em dados reais."
      />

      <ModuleTabs tabs={INTELLIGENCE_MODULE_TABS} />

      <PerfilInteligenciaClient data={learned} />
    </div>
  );
}
