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
      //
      // `media_not_found` (a Meta não reconhece a publicação) e `media_unsynced`
      // (o Inst Acessor não tem a publicação no banco) são 409: são estados do
      // RECURSO, não indisponibilidade do serviço — e a ação do usuário é
      // diferente em cada um.
      const status =
        result.code === "no_connection" ||
        result.code === "not_connected" ||
        result.code === "media_not_found" ||
        result.code === "media_unsynced"
          ? 409
          : 502;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          items: [],
          emptyReason: result.emptyReason ?? null,
          fetchedCount: result.fetchedCount ?? null,
        },
        { status }
      );
    }

    return NextResponse.json({
      media: result.media,
      // Diagnóstico do vazio: a UI distingue "a Meta não devolveu comentário",
      // "todos já foram analisados", "falha de banco" e "publicação não
      // sincronizada" — em vez de mostrar "nenhum comentário novo" para todas.
      fetchedCount: result.fetchedCount ?? 0,
      dedupedCount: result.dedupedCount ?? 0,
      emptyReason: result.emptyReason ?? "has_items",
      dbError: result.dbError ?? null,
      // Falhas por comentário: a leva pode ter sido PARCIAL. Sem este campo a
      // tela contava só os itens e apresentava o resto como se não existisse.
      readErrors: result.readErrors ?? [],
      // Persistência e paginação: falha ao gravar e leitura truncada são
      // situações distintas que antes não tinham como chegar até a tela.
      persistError: result.persistError ?? null,
      truncated: result.truncated ?? false,
      pagesFetched: result.pagesFetched ?? null,
      usedStoredFallback: result.usedStoredFallback ?? false,
      liveError: result.usedStoredFallback ? result.error ?? null : null,
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
