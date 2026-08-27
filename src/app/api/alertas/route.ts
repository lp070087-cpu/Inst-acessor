import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateAlerts } from "@/lib/knowledge/alerts";
import { scorePlatformSchema } from "@/lib/validators/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/alertas?platform=instagram|tiktok
 * Retorna alertas determinísticos derivados de dados reais.
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

    const alerts = await generateAlerts(userId, platform);

    return NextResponse.json({
      platform,
      alerts,
    });
  } catch (err) {
    console.error("[alertas] erro", err);
    return NextResponse.json({ error: "Não foi possível gerar alertas." }, { status: 500 });
  }
}
