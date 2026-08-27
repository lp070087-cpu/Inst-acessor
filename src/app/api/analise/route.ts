import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { runAnalysis } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/analise?platform=instagram|tiktok&period=7d|30d|90d
 * Retorna métricas reais do usuário a partir dos snapshots persistidos.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");
    const period = url.searchParams.get("period");

    if (platform !== "instagram" && platform !== "tiktok") {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    if (period !== "7d" && period !== "30d" && period !== "90d") {
      return NextResponse.json({ error: "período inválido" }, { status: 400 });
    }

    const result = await runAnalysis(userId, platform, period);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[analise] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar a análise." }, { status: 500 });
  }
}
