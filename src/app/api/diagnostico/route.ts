import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { scorePlatformSchema } from "@/lib/validators/ai";
import { runDiagnosis } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/diagnostico?platform=instagram|tiktok
 * Retorna o diagnóstico quantitativo/estrutural do perfil.
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

    const items = await runDiagnosis(userId, parsed.data);
    return NextResponse.json({ platform: parsed.data, items });
  } catch (err) {
    console.error("[diagnostico] erro", err);
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico." }, { status: 500 });
  }
}
