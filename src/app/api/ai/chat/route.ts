import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { chatCreateSchema } from "@/lib/validators/ai";
import {
  sendChatMessage,
  AIConfiguredErrorChat,
} from "@/lib/ai/services";
import { createRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * RATE LIMIT POR USUÁRIO — o chat também aciona o provedor de IA a cada
 * mensagem. 60/min é folgado para conversa humana (uma pessoa não escreve 60
 * mensagens por minuto) e corta laço/abuso que multiplicaria custo. In-memory,
 * best-effort — ver o módulo `publishing/rate-limit`.
 */
const chatRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/**
 * POST /api/ai/chat
 * Envia uma mensagem ao chat IA Acessor. Cria a conversa se necessário.
 * Requer sessão + input Zod. Sem provider configurado → estado controlado.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!chatRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas mensagens em pouco tempo. Aguarde um instante." },
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
