import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { chatCreateSchema } from "@/lib/validators/ai";
import { aiRateLimiter } from "@/lib/publishing/rate-limit";
import {
  sendChatMessage,
  AIConfiguredErrorChat,
} from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/chat
 * Envia uma mensagem ao chat IA Acessor. Cria a conversa se necessário.
 * Requer sessão + input Zod. Sem provider configurado → estado controlado.
 * Rate limit por usuário (evita abuso de custo de IA).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!aiRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas solicitações. Aguarde um instante e tente novamente." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = chatCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { conversationId, message } = parsed.data;

    const result = await sendChatMessage(userId, { conversationId, message });

    return NextResponse.json({
      ok: true,
      conversation: serializeConversation(result.conversation),
      reply: result.assistantReply,
    });
  } catch (err) {
    if (err instanceof AIConfiguredErrorChat) {
      return NextResponse.json(
        { error: "IA_NAO_CONFIGURADA", message: "A IA ainda não foi configurada." },
        { status: 503 }
      );
    }
    console.error("[ai/chat] erro", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a resposta. Tente novamente." },
      { status: 500 }
    );
  }
}

function serializeConversation(conv: {
  id: string;
  title: string;
  updatedAt: Date;
  messages: { id: string; role: string; content: string; createdAt: Date }[];
}) {
  return {
    id: conv.id,
    title: conv.title,
    updatedAt: conv.updatedAt.toISOString(),
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
