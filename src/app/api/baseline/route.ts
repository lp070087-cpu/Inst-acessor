import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { computeIndividualBaseline } from "@/lib/knowledge/baseline";
import { scorePlatformSchema } from "@/lib/validators/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/baseline?platform=instagram|tiktok
 * Retorna o baseline individual do perfil (comparar sempre com o próprio
 * histórico, nunca com números universais).
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = scorePlatformSchema.safeParse(url.searchParams.get("platform"));
    if (!parsed.success) {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    const platform = parsed.data;

    const baseline = await computeIndividualBaseline(userId, platform);
    return NextResponse.json({ baseline });
  } catch (err) {
    console.error("[baseline] erro", err);
    return NextResponse.json({ error: "Não foi possível calcular o baseline." }, { status: 500 });
  }
}
