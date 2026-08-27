import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { listConversations, getConversation } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/conversations
 * Lista conversas do usuário (mais recentes primeiro).
 * GET /api/ai/conversations?id=... — retorna uma conversa com mensagens.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const conv = await getConversation(userId, id);
      if (!conv) {
        return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
      }
      return NextResponse.json({
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt.toISOString(),
        messages: conv.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    const convs = await listConversations(userId);
    return NextResponse.json(
      convs.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c.messages?.length ?? 0,
      }))
    );
  } catch (err) {
    console.error("[ai/conversations] erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as conversas." },
      { status: 500 }
    );
  }
}
