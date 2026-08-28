import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { duplicatePlannedContent } from "@/lib/planning";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/duplicate?id=... — duplica um conteúdo planejado.
 * Session-required + owner-checked.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const created = await duplicatePlannedContent(userId, id);
    if (!created) {
      return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
    }

    await grantXp(userId, "planejar-conteudo", created.id);
    await checkAndUnlockAchievements(userId);

    return NextResponse.json({ ok: true, content: created });
  } catch (err) {
    console.error("[calendar] erro ao duplicar", err);
    return NextResponse.json({ error: "Erro ao duplicar conteúdo." }, { status: 500 });
  }
}
