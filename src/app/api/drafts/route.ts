import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { saveDraftSchema } from "@/lib/validators/ai";
import { listDrafts, saveDraft, updateDraft, deleteDraft } from "@/lib/ai/services";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET    /api/drafts — lista rascunhos do usuário
 * POST   /api/drafts — salva um rascunho
 * PATCH  /api/drafts?id=... — atualiza um rascunho
 * DELETE /api/drafts?id=... — exclui
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = await listDrafts(userId);
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        mediaType: r.mediaType,
        mediaUrl: r.mediaUrl ?? "",
        caption: r.caption ?? "",
        hashtags: r.hashtags ?? "",
        format: r.format ?? "",
        items: r.items ?? [],
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[drafts] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar os rascunhos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const created = await saveDraft(userId, parsed.data);
    const row = created as unknown as {
      id: string;
      platform: string;
      mediaType: string;
      mediaUrl: string | null;
      caption: string | null;
      hashtags: string | null;
      format: string | null;
      items?: unknown;
      updatedAt: Date;
    };

    // XP por ação real (idempotente por source+refId = draft id).
    await grantXp(userId, "criar-rascunho", row.id);
    await checkAndUnlockAchievements(userId);

    return NextResponse.json({
      ok: true,
      draft: {
        id: row.id,
        platform: row.platform,
        mediaType: row.mediaType,
        mediaUrl: row.mediaUrl ?? "",
        caption: row.caption ?? "",
        hashtags: row.hashtags ?? "",
        format: row.format ?? "",
        items: row.items ?? [],
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[drafts] erro ao salvar", err);
    return NextResponse.json({ error: "Não foi possível salvar o rascunho." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = await request.json();
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const updated = await updateDraft(userId, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[drafts] erro ao atualizar", err);
    return NextResponse.json({ error: "Erro ao atualizar rascunho." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deleteDraft(userId, id);
    if (!ok) return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[drafts] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir rascunho." }, { status: 500 });
  }
}
