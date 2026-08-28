import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { attachExperimentSchema } from "@/lib/validators/planning";
import { attachExperimentToContent, detachExperimentFromContent } from "@/lib/planning";

export const dynamic = "force-dynamic";

/**
 * FASE 6 — ASSOCIAÇÃO CONTEÚDO ↔ EXPERIMENTO
 * ============================================
 * POST   /api/calendar/experiments?id=... — associa um experimento ao conteúdo
 * DELETE /api/calendar/experiments?id=...&experimentId=... — remove associação
 *
 * Session-required + owner-checked. Idempotente (constraint única).
 * NUNCA inventa resultados — apenas prepara a medição futura.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = await request.json();
    const parsed = attachExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const ok = await attachExperimentToContent(userId, id, parsed.data.experimentId);
    if (!ok) return NextResponse.json({ error: "Conteúdo ou experimento não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[calendar] erro ao associar experimento", err);
    return NextResponse.json({ error: "Erro ao associar experimento." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const experimentId = url.searchParams.get("experimentId");
    if (!id || !experimentId) {
      return NextResponse.json({ error: "id e experimentId ausentes" }, { status: 400 });
    }

    const ok = await detachExperimentFromContent(userId, id, experimentId);
    if (!ok) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[calendar] erro ao remover experimento", err);
    return NextResponse.json({ error: "Erro ao remover experimento." }, { status: 500 });
  }
}
