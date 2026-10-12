import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { sendManualReply } from "@/lib/comment-direct/conversation";
import { sendDirectMessageSchema } from "@/lib/validators/comment-direct";
import { automationRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-direct/conversations/[id]/send
 *
 * ENVIO MANUAL de uma resposta — a única origem de envio no painel de conversa.
 * O humano aprova o texto (ou a sugestão da IA) e ESTA rota envia.
 *
 * Travas (todas revalidadas no serviço):
 *   - sessão + conversa pertence ao usuário;
 *   - permissão de mensagens concedida (escopo persistido);
 *   - janela de 24h da Meta aberta;
 *   - rate limit por usuário.
 *
 * A sugestão da IA NUNCA é enviada por aqui sem o texto final aprovado.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!automationRateLimiter.check(`direct-send-${userId}`)) {
      return NextResponse.json({ error: "Muitas mensagens em pouco tempo. Aguarde." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = sendDirectMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const result = await sendManualReply(userId, params.id, parsed.data.text, {
      approvedFromSuggestion: parsed.data.approvedFromSuggestion,
      suggestion: parsed.data.suggestion ?? null,
    });

    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "window_closed"
            ? 409
            : result.code === "capability" || result.code === "no_connection"
              ? 409
              : 502;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[comment-direct/conversations/send] erro", err);
    return NextResponse.json({ error: "Não foi possível enviar a mensagem." }, { status: 500 });
  }
}
