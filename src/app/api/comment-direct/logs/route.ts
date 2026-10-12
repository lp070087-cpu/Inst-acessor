import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { listDirectLogs } from "@/lib/comment-direct/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-direct/logs — histórico de disparos com o MOTIVO.
 *
 * Cada linha corresponde a um `CommentDirectLog`: o que aconteceu quando um
 * comentário casou (ou não) um gatilho. Só o dono lê (filtro por `userId`).
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 100;

    const logs = await listDirectLogs(
      session.user.id,
      Number.isFinite(limit) ? limit : 100
    );

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("[comment-direct/logs] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }
}
