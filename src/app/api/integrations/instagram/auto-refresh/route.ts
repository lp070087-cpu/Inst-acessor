import { withSessionApi } from "@/lib/auth/session-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { refreshInstagramIfStale } from "@/lib/integrations/instagram/auto-refresh";

export const dynamic = "force-dynamic";

/**
 * Atualização automática controlada das métricas do Instagram.
 *
 * Não sincroniza sempre: só quando o último sync passou do TTL (1h). Quando
 * sincroniza, devolve `refreshed: true` para o cliente recarregar os dados
 * salvos. A tela NUNCA depende desta resposta para renderizar — ela já mostrou
 * os dados do banco antes de chamar isto.
 *
 * Diferente do sync manual, não devolve erro 4xx para estados normais
 * (desconectado / ainda fresco): são respostas ESPERADAS, não falhas.
 */
async function POSTHandler() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const outcome = await refreshInstagramIfStale(userId);
    return NextResponse.json(outcome);
  } catch (err) {
    // Falha inesperada: nunca vaza detalhe interno; o cliente ignora e segue
    // mostrando os dados salvos.
    console.error("[instagram-auto-refresh] falha inesperada", err);
    return NextResponse.json({ refreshed: false, skipped: "error" }, { status: 500 });
  }
}

export const POST = withSessionApi(POSTHandler);
