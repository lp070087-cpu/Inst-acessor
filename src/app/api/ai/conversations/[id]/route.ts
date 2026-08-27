import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteConversation } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/ai/conversations/[id]
 * Exclui uma conversa (cascade nas mensagens). Só o dono.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const ok = await deleteConversation(userId, params.id);
    if (!ok) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ai/conversations] erro ao excluir", err);
    return NextResponse.json(
      { error: "Não foi possível excluir a conversa." },
      { status: 500 }
    );
  }
}
