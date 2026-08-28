import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { runGrowthPipeline } from "@/lib/growth-engine";
import { GrowthEngineClient } from "@/components/growth/growth-engine-client";

export const metadata: Metadata = {
  title: "Automações Inteligentes",
  description: "Motor operacional de crescimento do Inst Acessor.",
};

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  const { session } = await requireOnboardedSession();

  // O pipeline roda no servidor (dados reais, owner-checked) e é hidratado no client.
  const output = await runGrowthPipeline(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-[12px] bg-gradient-to-br from-pink-500 via-purple to-indigo text-white">
            <Zap size={18} />
          </div>
          <h1 className="font-display text-[26px] font-bold text-ink">Automações Inteligentes</h1>
        </div>
        <p className="text-[13.5px] text-ink-soft">
          Sinais, prioridades e recomendações para crescer com dados reais.
        </p>
      </div>

      {/* Motor de crescimento */}
      <GrowthEngineClient
        initial={{
          context: output.context,
          signals: output.signals,
          priorities: output.priorities,
          recommendations: output.recommendations,
          actions: output.actions,
          mission: output.mission,
          plan7: output.plan7,
          plan30: output.plan30,
          insights: output.insights,
          automations: output.automations,
          changes: output.changes,
          confidence: output.confidence,
          insufficientData: output.insufficientData,
        }}
      />
    </div>
  );
}
