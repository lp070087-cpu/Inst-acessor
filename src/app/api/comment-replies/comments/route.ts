import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { analyzeMedia } from "@/lib/comment-replies/engine";
import { analyzeSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-replies/comments
 *
 * Lê os comentários elegíveis de uma publicação, classifica e gera sugestões.
 * NÃO envia nada — o envio é sempre um passo separado e explícito
 * (`/approve`), o que garante que a Fase 2 nunca publique sozinha.
 *
 * Persiste cada comentário analisado em `CommentReplyLog` com status PENDING,
 * que é também o mecanismo de idempotência (um comentário por registro).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const result = await analyzeMedia(session.user.id, parsed.data.mediaId, {
      onlyUnanswered: parsed.data.onlyUnanswered,
      persist: true,
    });

    if (!result.ok) {
      // Erros de capacidade/conexão são devolvidos com o motivo REAL da Meta
      // em vez de um "algo deu errado" genérico.
      const status = result.code === "no_connection" || result.code === "not_connected" ? 409 : 502;
      return NextResponse.json(
        { error: result.error, code: result.code, items: [] },
        { status }
      );
    }

    return NextResponse.json({
      media: result.media,
      items: result.items.map((item) => ({
        commentId: item.comment.commentId,
        username: item.comment.username,
        text: item.comment.text,
        timestamp: item.comment.timestamp,
        category: item.category,
        decisionKind: item.decisionKind,
        generatedReply: item.generatedReply,
        status: item.status,
        reviewReason: item.reviewReason,
        reviewReasonLabel: item.reviewReasonLabel,
        autoSendable: item.autoSendable,
        source: item.source,
        logId: item.logId,
        error: item.error,
      })),
    });
  } catch (err) {
    console.error("[comment-replies/comments] erro", err);
    return NextResponse.json({ error: "Não foi possível analisar os comentários." }, { status: 500 });
  }
}
