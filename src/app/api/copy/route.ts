import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { saveCopySchema } from "@/lib/validators/ai";
import {
  listCopies,
  saveCopy,
  toggleCopyFavorite,
  deleteCopy,
} from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET  /api/copy — lista copies salvos do usuário
 * POST /api/copy — salva uma copy
 * PATCH /api/copy?id=...&favorite=1 — alterna favorito
 * DELETE /api/copy?id=... — exclui
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const rows = await listCopies(userId);
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        format: r.format,
        content: r.content,
        isFavorite: r.isFavorite,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[copy] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as copies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = saveCopySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const saved = await saveCopy(userId, parsed.data);
    const row = saved as unknown as {
      id: string;
      platform: string;
      format: string;
      content: string;
      isFavorite: boolean;
      createdAt: Date;
    };
    return NextResponse.json({
      ok: true,
      copy: {
        id: row.id,
        platform: row.platform,
        format: row.format,
        content: row.content,
        isFavorite: row.isFavorite,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[copy] erro ao salvar", err);
    return NextResponse.json({ error: "Não foi possível salvar a copy." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const updated = await toggleCopyFavorite(userId, id);
    if (!updated) {
      return NextResponse.json({ error: "Copy não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[copy] erro ao favoritar", err);
    return NextResponse.json({ error: "Erro ao favoritar copy." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deleteCopy(userId, id);
    if (!ok) return NextResponse.json({ error: "Copy não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[copy] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir copy." }, { status: 500 });
  }
}
