import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { restoreCopyVersion } from "@/lib/planning";

export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/copy-versions/restore?contentId=...&version=N
 * Restaura uma versão antiga criando uma NOVA versão com o texto antigo.
 * Nunca sobrescreve silenciosamente. Session-required + owner-checked.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    const version = url.searchParams.get("version");
    if (!contentId || !version) {
      return NextResponse.json({ error: "contentId e version ausentes" }, { status: 400 });
    }

    const created = await restoreCopyVersion(userId, contentId, Number(version));
    if (!created) {
      return NextResponse.json({ error: "Conteúdo ou versão não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, version: created });
  } catch (err) {
    console.error("[calendar] erro ao restaurar versão", err);
    return NextResponse.json({ error: "Erro ao restaurar versão." }, { status: 500 });
  }
}
