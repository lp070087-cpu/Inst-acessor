import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getPlannedContent } from "@/lib/planning";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/detail?id=... — detalhe completo de um conteúdo planejado.
 * Session-required + owner-checked.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const row = await getPlannedContent(userId, id);
    if (!row) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      platform: row.platform,
      format: row.format,
      title: row.title,
      theme: row.theme ?? "",
      objective: row.objective ?? "",
      status: row.status,
      scheduledAt: row.scheduledAt,
      publishedAt: row.publishedAt,
      externalId: row.externalId,
      notes: row.notes ?? "",
      hypothesis: row.hypothesis ?? "",
      ideaId: row.ideaId,
      copyId: row.copyId,
      draftId: row.draftId,
      goalId: row.goalId,
      experimentIds: row.experimentIds,
      copyVersionCount: row.copyVersionCount,
      ideaTitle: row.ideaTitle ?? "",
      copyContent: row.copyContent ?? "",
      draftCaption: row.draftCaption ?? "",
      goalTitle: row.goalTitle ?? "",
      experimentTitles: row.experimentTitles,
      createdAt: row.createdAt,
    });
  } catch (err) {
    console.error("[calendar] erro ao carregar detalhe", err);
    return NextResponse.json({ error: "Erro ao carregar detalhe." }, { status: 500 });
  }
}
