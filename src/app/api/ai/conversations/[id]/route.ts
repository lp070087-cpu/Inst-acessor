import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteConversation, renameConversation } from "@/lib/ai/services";
import { renameConversationSchema } from "@/lib/validators/ai";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/ai/conversations/[id]
 * Exclui uma conversa (cascade nas mensagens). Só o dono.
 */
async function DELETEHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const ok = await deleteConversation(userId, (await params).id);
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

/**
 * PATCH /api/ai/conversations/[id]  — ITEM 10
 * Renomeia a conversa. Só o dono (a checagem de posse vive no serviço, em uma
 * única consulta, e devolve `null` tanto para "não existe" quanto para "não é
 * sua" — a rota não revela qual dos dois).
 *
 * 400 = título ausente/vazio (o Zod corta antes de tocar no banco)
 * 404 = conversa inexistente ou de outro usuário
 * 200 = título REALMENTE gravado, devolvido para a UI não confiar no que digitou
 */
async function PATCHHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    const parsed = renameConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Nome inválido" },
        { status: 400 }
      );
    }

    const updated = await renameConversation(userId, (await params).id, parsed.data.title);
    if (!updated) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, title: updated.title });
  } catch (err) {
    console.error("[ai/conversations] erro ao renomear", err);
    return NextResponse.json(
      { error: "Não foi possível renomear a conversa." },
      { status: 500 }
    );
  }
}

export const DELETE = withPremiumApi(DELETEHandler);

export const PATCH = withPremiumApi(PATCHHandler);
