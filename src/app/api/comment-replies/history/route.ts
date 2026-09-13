import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { listLogs } from "@/lib/comment-replies/db";
import { historyQuerySchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-replies/history?status=&mediaId=&limit=
 *
 * Histórico com filtros: enviados, pendentes, ignorados, erro, manual,
 * automático. "manual"/"automático" são filtros derivados de `sourceRule`,
 * já que ambos terminam com status SENT.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);

    const parsed = historyQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? "ALL",
      mediaId: url.searchParams.get("mediaId") ?? undefined,
      limit: url.searchParams.get("limit") ?? 100,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
    }

    const logs = await listLogs(session.user.id, {
      status: parsed.data.status,
      mediaId: parsed.data.mediaId,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("[comment-replies/history] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }
}
