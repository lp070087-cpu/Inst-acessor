import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getMediaInsights } from "@/lib/publishing/media-insights-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/publishing/media-insights?mediaId=<ig-media-id>
 *
 * Insights de UMA publicação, em três abas (Visão geral, Engajamento, Público).
 *
 * Fonte: dados JÁ sincronizados no banco (`InstagramMedia`,
 * `InstagramMediaMetric`, `InstagramComment`). Esta rota não fala com a Meta e
 * não dispara sincronização — por isso é rápida e não gasta cota da API.
 *
 * Ausência é honesta: quando a Meta não forneceu a métrica, o valor é `null` e a
 * tela mostra "Dado não disponibilizado pela Meta para esta publicação." —
 * nunca zero.
 *
 * 404 quando a publicação não existe OU não pertence ao usuário (o filtro por
 * `userId` está na consulta, então não há como vazar mídia de outra conta).
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const mediaId = new URL(request.url).searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        { error: "Informe a publicação (mediaId)." },
        { status: 400 }
      );
    }

    const data = await getMediaInsights(session.user.id, mediaId);

    if (!data.found) {
      return NextResponse.json(
        {
          error:
            "Publicação não encontrada. Sincronize a conta em Redes Sociais para atualizar a lista.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    // Falha de sessão/guard tem status próprio; não expomos detalhe interno.
    if (err instanceof Error && /sess|autentic|login/i.test(err.message)) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }
    console.error("[media-insights] falha ao ler insights da publicação");
    return NextResponse.json(
      { error: "Não foi possível carregar os insights desta publicação." },
      { status: 500 }
    );
  }
}
