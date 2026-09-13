import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getOrCreateRule, getStats, listLogs } from "@/lib/comment-replies/db";
import { aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-replies/stats
 *
 * Métricas do painel. TODAS derivadas de `CommentReplyLog` — nenhum número é
 * estimado, projetado ou inventado. A "taxa de aprovação" é calculada apenas
 * sobre decisões já tomadas (enviadas / (enviadas + ignoradas)); enquanto não
 * houver decisão, devolve `null` em vez de 0% ou 100% enganoso.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [rule, stats, pending, ai] = await Promise.all([
      getOrCreateRule(userId),
      getStats(userId, since),
      listLogs(userId, { status: "PENDING", limit: 50 }),
      aiConfigured(),
    ]);

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      automation: {
        enabled: rule.enabled,
        paused: rule.paused,
        mode: rule.replyMode,
        active: rule.enabled && !rule.paused,
      },
      aiConfigured: ai,
      stats,
      pendingCount: pending.length,
    });
  } catch (err) {
    console.error("[comment-replies/stats] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar as métricas." }, { status: 500 });
  }
}
