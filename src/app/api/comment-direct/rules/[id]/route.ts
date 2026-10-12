import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteDirectRule, findDirectRule, updateDirectRule } from "@/lib/comment-direct/db";
import { validateTriggerConfig } from "@/lib/comment-direct/triggers";
import { updateDirectRuleSchema } from "@/lib/validators/comment-direct";

export const dynamic = "force-dynamic";

/**
 * PATCH  /api/comment-direct/rules/[id] — edita / ativa / pausa
 * DELETE /api/comment-direct/rules/[id] — remove (owner-check)
 *
 * Owner-check por `userId` em TODAS as operações: uma regra de outro usuário é
 * um 404, nunca um acesso.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const owned = await findDirectRule(userId, params.id);
    if (!owned) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });

    const body = await request.json();
    const parsed = updateDirectRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { paused, ...rest } = parsed.data;

    // Revalida a configuração RESULTANTE (o que o usuário quer menos os campos
    // que ele não mandou) — uma edição parcial não pode deixar o gatilho
    // inválido (ex.: trocar o tipo e manter a lista antiga vazia).
    const nextType = rest.triggerType ?? owned.triggerType;
    const nextTerms = rest.triggerTerms ?? owned.triggerTerms;
    const nextMessage = rest.messageText ?? owned.messageText;
    const triggerErrors = validateTriggerConfig({
      triggerType: nextType,
      triggerTerms: nextTerms,
      messageText: nextMessage,
    });
    if (triggerErrors.length > 0) {
      return NextResponse.json(
        { error: triggerErrors[0].message, field: triggerErrors[0].field },
        { status: 400 }
      );
    }

    // `paused: true` vira uma pausa de 24h sem desligar a regra; `false` limpa.
    const pausedUntil = paused === true ? new Date(Date.now() + 24 * 60 * 60 * 1000) : paused === false ? null : undefined;

    const rule = await updateDirectRule(userId, params.id, {
      ...rest,
      ...(rest.triggerTerms ? { triggerTerms: rest.triggerTerms.map((t) => t.trim()).filter(Boolean) } : {}),
      ...(rest.messageText ? { messageText: rest.messageText.trim() } : {}),
      ...(pausedUntil !== undefined ? { pausedUntil } : {}),
    });

    return NextResponse.json({ ok: true, rule });
  } catch (err) {
    console.error("[comment-direct/rules/[id]] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível salvar a automação." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const removed = await deleteDirectRule(session.user.id, params.id);
    if (!removed) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-direct/rules/[id]] erro ao excluir", err);
    return NextResponse.json({ error: "Não foi possível excluir a automação." }, { status: 500 });
  }
}
