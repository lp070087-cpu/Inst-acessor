import { withSessionApi } from "@/lib/auth/session-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateAIOpportunitySummary } from "@/lib/ai/opportunities";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities/summarize
 * ===============================
 * Priorização OPCIONAL das oportunidades pela IA CENTRAL (config do Admin →
 * env — ver `@/lib/ai/runtime`). Não existe segunda configuração de IA.
 *
 * Regras (idênticas a `/api/dashboard/insights`):
 *   - a IA só é chamada quando há chave ativa E oportunidades reais;
 *   - "sem IA" e "sem dados" → 200 com `state` explicando (a seção mostra a
 *     mensagem discreta), porque não são erro de servidor;
 *   - falha REAL da IA → 502, para o cliente distinguir de "não configurada";
 *   - nenhum número ou recomendação é inventado em nenhum caminho.
 */
async function GETHandler() {
  try {
    const session = await requireSession();
    const result = await generateAIOpportunitySummary(session.user.id);

    if (result.providerFailed) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[opportunities] erro", err);
    return NextResponse.json(
      {
        state: "error",
        summary: null,
        message: "Não foi possível priorizar as oportunidades agora.",
        providerFailed: true,
      },
      { status: 500 }
    );
  }
}

export const GET = withSessionApi(GETHandler);
