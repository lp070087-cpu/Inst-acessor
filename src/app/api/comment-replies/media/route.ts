import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import {
  listEligibleMedia,
  listStoredComments,
  loadCommentCredentials,
  CommentCapabilityError,
} from "@/lib/comment-replies/instagram-comments";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-replies/media
 *
 * Lista publicações (posts, carrosséis e Reels) da conta conectada, com
 * thumbnail, legenda, data, tipo e contagem de comentários.
 *
 * Os dados vêm do banco (`InstagramMedia` + `InstagramComment`), já
 * sincronizados pelo fluxo de Redes Sociais — nenhuma chamada extra à API e
 * nenhum dado inventado.
 *
 * `?mediaId=<ig-media-id>` acrescenta os COMENTÁRIOS REAIS já sincronizados
 * dessa publicação (`comments`), permitindo à tela mostrar o que existe sem
 * depender de a Meta liberar a leitura ao vivo.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    let connected = true;
    let connectionIssue: string | null = null;
    try {
      await loadCommentCredentials(userId);
    } catch (err) {
      connected = false;
      connectionIssue =
        err instanceof CommentCapabilityError
          ? err.message
          : "Conecte seu Instagram em Redes Sociais para usar Respostas Inteligentes.";
    }

    // LEITURAS ISOLADAS: uma falha de conexão do Prisma em UMA consulta não
    // pode derrubar a tela inteira (era o que acontecia — `kind: Closed` no
    // primeiro findFirst virava 500 e a tela ficava sem publicações).
    // Cada bloco degrada para um valor vazio EXPLÍCITO + sinaliza `dbError`.

    let media: Awaited<ReturnType<typeof listEligibleMedia>> = [];
    let mediaFailed = false;
    try {
      media = await listEligibleMedia(userId);
    } catch (err) {
      mediaFailed = true;
      console.error("[comment-replies/media] listEligibleMedia", err);
    }

    // Comentários da publicação pedida (quando houver `?mediaId=`).
    const mediaId = new URL(request.url).searchParams.get("mediaId");
    let comments: Awaited<ReturnType<typeof listStoredComments>> = [];
    let commentsFailed = false;
    if (mediaId) {
      try {
        comments = await listStoredComments(userId, mediaId);
      } catch (err) {
        commentsFailed = true;
        console.error("[comment-replies/media] listStoredComments", err);
      }
    }

    // Capacidade REAL de leitura de comentários e última sincronização — vêm do
    // banco, não de suposição. `commentsAvailable === false` significa que a Meta
    // recusou o escopo: a tela mostra "indisponível", nunca "0 comentários".
    let conn: {
      commentsAvailable: boolean | null;
      lastSyncAt: Date | null;
      lastSyncAttemptAt: Date | null;
    } | null = null;
    let connFailed = false;
    try {
      conn = await prisma.socialConnection.findFirst({
        where: { userId, platform: "instagram" },
        select: { commentsAvailable: true, lastSyncAt: true, lastSyncAttemptAt: true },
      });
    } catch (err) {
      connFailed = true;
      console.error("[comment-replies/media] socialConnection", err);
    }

    // Falha de banco NÃO é "sem dados": vai sinalizada, para a tela dizer
    // "não foi possível ler agora" em vez de mostrar uma lista vazia como se
    // fosse a realidade da conta.
    const dbError = mediaFailed || commentsFailed || connFailed;

    return NextResponse.json({
      connected,
      connectionIssue,
      media,
      comments,
      commentsAvailable: conn?.commentsAvailable ?? null,
      lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
      lastSyncAttemptAt: conn?.lastSyncAttemptAt
        ? conn.lastSyncAttemptAt.toISOString()
        : null,
      dbError,
      mediaFailed: mediaFailed || undefined,
      commentsFailed: commentsFailed || undefined,
    });
  } catch (err) {
    console.error("[comment-replies/media] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar as publicações." }, { status: 500 });
  }
}
