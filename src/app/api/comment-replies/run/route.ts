import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { runAutomation } from "@/lib/comment-replies/engine";
import { listEligibleMedia } from "@/lib/comment-replies/instagram-comments";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-replies/run
 *
 * Executa o ciclo AUTOMÁTICO. Só faz algo quando o usuário configurou o modo
 * "Automático" E a automação está ativa E não está pausada — caso contrário
 * devolve o motivo, sem enviar nada.
 *
 * Este endpoint é a estrutura de execução do sistema. Ele NÃO se auto-agenda e
 * NÃO faz polling: quem chama é (a) o botão "Executar agora" da tela, ou
 * (b) um agendador/cron externo, quando existir. Não há laço nem timer aqui.
 *
 * Todos os limites (por execução, hora, dia e intervalo mínimo) são aplicados
 * dentro de `runAutomation`.
 */
export async function POST() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const media = await listEligibleMedia(userId);
    const mediaIds = media.slice(0, 5).map((m) => m.id);

    if (mediaIds.length === 0) {
      return NextResponse.json({
        ok: false,
        reason: "Nenhuma publicação sincronizada para analisar.",
        code: "no_media",
        sent: 0,
        skipped: 0,
        details: [],
      });
    }

    const result = await runAutomation(userId, mediaIds);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[comment-replies/run] erro", err);
    return NextResponse.json({ error: "Não foi possível executar a automação." }, { status: 500 });
  }
}
