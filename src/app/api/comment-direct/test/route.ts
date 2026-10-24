import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { simulateTrigger } from "@/lib/comment-direct/engine";
import { testTriggerSchema } from "@/lib/validators/comment-direct";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-direct/test
 *
 * SIMULAÇÃO: casa um texto contra as regras do usuário e devolve o que
 * ACONTECERIA — **sem enviar nada e sem gravar log**.
 *
 * É o botão "Testar gatilho" da tela. Nunca toca a API da Meta e nunca cria
 * registro em `CommentDirectLog`, então testar não consome a idempotência de
 * nenhum comentário real.
 */
async function POSTHandler(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = testTriggerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const results = await simulateTrigger(
      session.user.id,
      parsed.data.mediaId ?? null,
      parsed.data.text
    );

    return NextResponse.json({
      ok: true,
      // Qualquer regra casou? A tela usa isto para o resumo do teste.
      anyMatched: results.some((r) => r.matched),
      results,
    });
  } catch (err) {
    console.error("[comment-direct/test] erro", err);
    return NextResponse.json({ error: "Não foi possível testar o gatilho." }, { status: 500 });
  }
}

export const POST = withPremiumApi(POSTHandler);
