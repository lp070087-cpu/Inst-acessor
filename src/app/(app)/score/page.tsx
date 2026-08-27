import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { computeScore, getScoreHistory, runDiagnosis } from "@/lib/ai/services";
import { ScoreClient } from "@/components/ai/score-client";

export const metadata: Metadata = {
  title: "Score Inteligente",
  description: "Seu Score 0–100 com diagnóstico por pilar, baseado em dados reais.",
};

export const dynamic = "force-dynamic";

export default async function ScorePage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  // Carrega ambos os perfis (dados reais dos snapshots).
  const [instagramScore, tiktokScore, instagramDiag, tiktokDiag, instagramHist, tiktokHist] =
    await Promise.all([
      computeScore(userId, "instagram"),
      computeScore(userId, "tiktok"),
      runDiagnosis(userId, "instagram"),
      runDiagnosis(userId, "tiktok"),
      getScoreHistory(userId, "instagram"),
      getScoreHistory(userId, "tiktok"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <BrainCircuit size={26} className="text-purple" />
          Score Inteligente
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Score 0–100 por pilar, determinístico e explicável. Derivado apenas de
          dados reais — nunca estimado.
        </p>
      </div>

      <ScoreClient
        initial={{
          instagram: {
            score: instagramScore,
            history: instagramHist.map((h) => ({
              id: h.id,
              overall: h.overall,
              createdAt: h.createdAt.toISOString(),
            })),
            diagnosis: instagramDiag,
          },
          tiktok: {
            score: tiktokScore,
            history: tiktokHist.map((h) => ({
              id: h.id,
              overall: h.overall,
              createdAt: h.createdAt.toISOString(),
            })),
            diagnosis: tiktokDiag,
          },
        }}
      />
    </div>
  );
}
