import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getConversationMessages } from "@/lib/comment-direct/conversation";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-direct/conversations/[id]/messages
 *
 * Mensagens de uma conversa do usuário. Complementa com a leitura oficial
 * quando a permissão permite; em qualquer falha, devolve o persistido.
 */
async function GETHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const result = await getConversationMessages(session.user.id, (await params).id);

    if (!result.ok && result.code === "not_found") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[comment-direct/conversations/messages] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar as mensagens." }, { status: 500 });
  }
}

export const GET = withPremiumApi(GETHandler);
