import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { runProfileLearning, getLearnedProfile } from "@/lib/ai/services";
import { aiRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * "ATUALIZAR APRENDIZADO" — POST /api/ai/profile/learn
 * ====================================================
 * Executa o aprendizado do perfil a pedido do usuário. Controles de custo:
 *  1. exige a IA configurada (senão 503, com mensagem clara);
 *  2. intervalo mínimo de 6h persistido por usuário (`learnedAt` em
 *     SystemSetting) — reexecutar antes disso devolve 429 com o próximo horário;
 *  3. rate limit in-memory por usuário (anti-clique repetido).
 *
 * Tudo escopado por `session.user.id`. Nada é lido nem gravado de outro usuário.
 */
async function POSTHandler() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!aiRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas atualizações em pouco tempo. Aguarde um instante." },
        { status: 429 }
      );
    }

    const result = await runProfileLearning(userId);

    if (!result.ok) {
      const status =
        result.reason === "not_configured" ? 503 : result.reason === "too_soon" ? 429 : 500;
      return NextResponse.json(
        { error: result.reason, message: result.message, nextAllowedAt: result.nextAllowedAt },
        { status }
      );
    }

    const data = await getLearnedProfile(userId);
    return NextResponse.json({
      ok: true,
      learnedAt: result.learnedAt,
      fieldsFilled: result.fieldsFilled,
      patternsAdded: result.patternsAdded,
      summary: result.summary,
      data,
    });
  } catch (err) {
    console.error("[ai/profile/learn] erro", err);
    return NextResponse.json(
      { error: "Não foi possível atualizar o aprendizado agora." },
      { status: 500 }
    );
  }
}

export const POST = withPremiumApi(POSTHandler);
