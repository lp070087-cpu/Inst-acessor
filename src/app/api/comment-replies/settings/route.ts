import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getOrCreateRule, updateRule } from "@/lib/comment-replies/db";
import { sanitizeLimits } from "@/lib/comment-replies/limits";
import { updateRuleSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * GET  /api/comment-replies/settings → configuração atual (cria se não existir)
 * PATCH /api/comment-replies/settings → atualiza modo, limites e pausa
 *
 * Somente o dono do registro acessa. Nenhum token é exposto.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const rule = await getOrCreateRule(session.user.id);
    return NextResponse.json({ rule });
  } catch (err) {
    console.error("[comment-replies/settings] erro ao ler", err);
    return NextResponse.json({ error: "Não foi possível carregar a configuração." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    // Limites são revalidados no servidor — o cliente não define valores fora
    // das faixas seguras, mesmo que envie algo diferente.
    const safeLimits = sanitizeLimits(parsed.data);
    const rule = await updateRule(session.user.id, { ...parsed.data, ...safeLimits });

    return NextResponse.json({ rule });
  } catch (err) {
    console.error("[comment-replies/settings] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível salvar a configuração." }, { status: 500 });
  }
}
