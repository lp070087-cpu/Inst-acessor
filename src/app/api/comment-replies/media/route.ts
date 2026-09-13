import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { listEligibleMedia, loadCommentCredentials, CommentCapabilityError } from "@/lib/comment-replies/instagram-comments";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-replies/media
 *
 * Lista publicações (posts, carrosséis e Reels) da conta conectada, com
 * thumbnail, legenda, data, tipo e contagem de comentários.
 *
 * Os dados vêm do banco (`InstagramMedia`), já sincronizado pelo fluxo
 * existente de Redes Sociais — nenhuma chamada extra à API e nenhum dado
 * inventado.
 *
 * Também informa se a conexão está utilizável, para a tela decidir entre
 * mostrar a lista ou o CTA de conectar o Instagram.
 */
export async function GET() {
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

    const media = await listEligibleMedia(userId);

    return NextResponse.json({ connected, connectionIssue, media });
  } catch (err) {
    console.error("[comment-replies/media] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar as publicações." }, { status: 500 });
  }
}
