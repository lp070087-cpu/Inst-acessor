import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { suggestReply } from "@/lib/comment-direct/conversation";
import { suggestReplySchema } from "@/lib/validators/comment-direct";
import { aiRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-direct/conversations/[id]/suggest
 *
 * Gera uma SUGESTÃO de resposta com IA para o humano revisar. NUNCA envia: o
 * envio é sempre um passo separado (`/send`) com o texto aprovado.
 *
 * A IA usa apenas a FAQ cadastrada + o histórico da conversa. Sem IA, cai para
 * a FAQ que casar; sem FAQ, não sugere nada (não inventa).
 */
async function POSTHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!aiRateLimiter.check(`direct-${userId}`)) {
      return NextResponse.json({ error: "Muitas solicitações de IA. Aguarde um instante." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = suggestReplySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const result = await suggestReply(userId, (await params).id, {
      lastIncomingText: parsed.data.lastIncomingText ?? null,
    });

    if (!result.ok && result.code === "not_found") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[comment-direct/conversations/suggest] erro", err);
    return NextResponse.json({ error: "Não foi possível gerar a sugestão." }, { status: 500 });
  }
}

export const POST = withPremiumApi(POSTHandler);
