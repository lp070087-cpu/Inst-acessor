import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getMediaProductionData } from "@/lib/dashboard/media-production";
import { generateAIInsights } from "@/lib/dashboard/insights";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/insights
 * ===========================
 * Insights do Dashboard gerados pela IA CENTRAL (config do Admin, com
 * fallback de env — ver `@/lib/ai/runtime`). NÃO existe segunda configuração
 * de IA aqui: o provider sai de `getAIProvider()`.
 *
 * Regras:
 *   - a IA só é chamada quando existe chave ativa E dado real suficiente;
 *   - resposta indisponível → 200 com `state` explicando (a Dashboard mostra
 *     a mensagem discreta), porque "sem IA" não é erro de servidor;
 *   - falha REAL da IA → 502, para o cliente distinguir de "não configurada";
 *   - nenhum número é inventado em nenhum caminho.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const [data, media] = await Promise.all([
      getDashboardInstagramData(userId),
      getMediaProductionData(userId),
    ]);

    const result = await generateAIInsights(data, media);

    // "Sem IA" e "sem dados" são estados NORMAIS (200). Só a falha real da IA
    // vira 502 — e a distinção vem de `providerFailed`, não de texto.
    if (result.providerFailed) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[dashboard-insights] erro", err);
    return NextResponse.json(
      {
        state: "error",
        insights: null,
        message: "Não foi possível gerar os insights agora.",
        providerFailed: true,
      },
      { status: 500 }
    );
  }
}
