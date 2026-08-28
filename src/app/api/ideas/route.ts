import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { saveIdeaSchema } from "@/lib/validators/ai";
import { listIdeas, saveIdea, updateIdeaStatus, deleteIdea } from "@/lib/ai/services";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET    /api/ideas — lista ideias do usuário
 * POST   /api/ideas — salva uma ideia gerada
 * PATCH  /api/ideas?id=...&status=FAVORITA — muda status
 * DELETE /api/ideas?id=... — exclui
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = await listIdeas(userId);
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        format: r.format ?? "",
        objective: r.objective ?? "",
        context: r.context ?? "",
        rationale: r.rationale ?? "",
        status: r.status,
        platform: r.platform ?? "",
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[ideas] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as ideias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = saveIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const created = await saveIdea(userId, {
      ...parsed.data,
      platform: parsed.data.platform || "instagram",
    });
    const row = created as unknown as {
      id: string;
      category: string;
      title: string;
      format: string | null;
      objective: string | null;
      context: string | null;
      rationale: string | null;
      status: string;
      platform: string | null;
      createdAt: Date;
    };

    // XP por ação real (idempotente por source+refId = idea id).
    await grantXp(userId, "salvar-ideia", row.id);
    await checkAndUnlockAchievements(userId);

    return NextResponse.json({
      ok: true,
      idea: {
        id: row.id,
        category: row.category,
        title: row.title,
        format: row.format ?? "",
        objective: row.objective ?? "",
        context: row.context ?? "",
        rationale: row.rationale ?? "",
        status: row.status,
        platform: row.platform ?? "",
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[ideas] erro ao salvar", err);
    return NextResponse.json({ error: "Não foi possível salvar a ideia." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    if (!id || !status) {
      return NextResponse.json({ error: "id e status ausentes" }, { status: 400 });
    }

    const updated = await updateIdeaStatus(userId, id, status);
    if (!updated) {
      return NextResponse.json({ error: "Ideia não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ideas] erro ao atualizar status", err);
    return NextResponse.json({ error: "Erro ao atualizar ideia." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deleteIdea(userId, id);
    if (!ok) return NextResponse.json({ error: "Ideia não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ideas] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir ideia." }, { status: 500 });
  }
}
