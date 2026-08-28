import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { addCopyVersionSchema } from "@/lib/validators/planning";
import { listCopyVersions, addCopyVersion } from "@/lib/planning";

export const dynamic = "force-dynamic";

/**
 * FASE 6 — VERSÕES DE COPY DO CONTEÚDO PLANEJADO
 * ================================================
 * GET    /api/calendar/copy-versions?contentId=... — lista versões
 * POST   /api/calendar/copy-versions?contentId=... — cria nova versão
 * POST   /api/calendar/copy-versions/restore?contentId=...&version=N — restaura
 *
 * Nunca sobrescreve: cada edição vira uma nova versão (1, 2, 3...).
 * Session-required + owner-checked.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    if (!contentId) return NextResponse.json({ error: "contentId ausente" }, { status: 400 });

    const rows = await listCopyVersions(userId, contentId);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[calendar] erro ao listar versões", err);
    return NextResponse.json({ error: "Erro ao listar versões." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    if (!contentId) return NextResponse.json({ error: "contentId ausente" }, { status: 400 });

    const body = await request.json();
    const parsed = addCopyVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const created = await addCopyVersion(userId, contentId, parsed.data);
    if (!created) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, version: created });
  } catch (err) {
    console.error("[calendar] erro ao criar versão", err);
    return NextResponse.json({ error: "Erro ao criar versão." }, { status: 500 });
  }
}
