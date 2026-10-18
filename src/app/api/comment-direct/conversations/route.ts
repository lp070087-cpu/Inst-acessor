import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { syncConversations } from "@/lib/comment-direct/conversation";
import { syncRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-direct/conversations
 *
 * Lê as conversas REAIS da conta (endpoints oficiais) e persiste as referências.
 * Quando a permissão de mensagens não foi concedida, devolve as conversas já
 * persistidas + o estado `permissionGranted: false` — a UI mostra "integração
 * pendente" em vez de uma thread inventada.
 *
 * Rate-limited por usuário: uma sincronização é uma chamada à Meta.
 */
async function GETHandler() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!syncRateLimiter.check(`direct-${userId}`)) {
      return NextResponse.json(
        { error: "Muitas sincronizações em pouco tempo. Aguarde um instante." },
        { status: 429 }
      );
    }

    const result = await syncConversations(userId);

    return NextResponse.json({
      ok: result.ok,
      code: result.code ?? null,
      error: result.error ?? null,
      permissionGranted: result.permissionGranted,
      notConnected: result.notConnected,
      conversations: result.conversations,
    });
  } catch (err) {
    console.error("[comment-direct/conversations] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar as conversas." }, { status: 500 });
  }
}

export const GET = withPremiumApi(GETHandler);
