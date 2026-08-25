import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { syncInstagram } from "@/lib/integrations/instagram";

export const dynamic = "force-dynamic";

/**
 * Sincroniza os dados do Instagram do usuário autenticado.
 *
 * Fluxo (todo no servidor):
 * 1. valida sessão
 * 2. recupera SocialConnection do usuário
 * 3. descriptografa token (servidor)
 * 4. busca perfil
 * 5. busca métricas disponíveis
 * 6. busca mídias
 * 7. normaliza
 * 8. salva perfil
 * 9. salva snapshot
 * 10. salva dados de mídia
 * 11. cria SyncLog
 * 12. atualiza lastSyncAt
 * 13. retorna resumo SEGURO (sem token)
 */
export async function POST(request: Request) {
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

  const result = await syncInstagram(userId);

  if (!result.ok) {
    // Cooldown → 429; demais erros → status controlado.
    if (result.code === "cooldown") {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 429 });
    }
    const status =
      result.code === "no_connection" || result.code === "not_connected"
        ? 400
        : result.code === "token_invalid"
          ? 401
          : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}
