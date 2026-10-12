import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { createDirectRule, listDirectRules } from "@/lib/comment-direct/db";
import { validateTriggerConfig } from "@/lib/comment-direct/triggers";
import { createDirectRuleSchema } from "@/lib/validators/comment-direct";
import { automationRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET  /api/comment-direct/rules — lista as regras do usuário
 * POST /api/comment-direct/rules — cria uma regra (nasce DESLIGADA)
 *
 * Session-required + owner-check (toda consulta filtra por `userId`). A regra
 * é validada pelo núcleo puro `validateTriggerConfig` ANTES de gravar — um
 * gatilho inválido nunca chega ao banco.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const rules = await listDirectRules(session.user.id);
    return NextResponse.json({ rules });
  } catch (err) {
    console.error("[comment-direct/rules] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as automações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!automationRateLimiter.check(`direct-${userId}`)) {
      return NextResponse.json({ error: "Muitas solicitações. Aguarde um momento." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = createDirectRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    // Validação do gatilho pelo núcleo puro (mesma regra que a tela usa).
    const triggerErrors = validateTriggerConfig({
      triggerType: parsed.data.triggerType,
      triggerTerms: parsed.data.triggerTerms,
      messageText: parsed.data.messageText,
    });
    if (triggerErrors.length > 0) {
      return NextResponse.json(
        { error: triggerErrors[0].message, field: triggerErrors[0].field },
        { status: 400 }
      );
    }

    const rule = await createDirectRule(userId, {
      name: parsed.data.name,
      mediaId: parsed.data.mediaId ?? null,
      mediaCaption: parsed.data.mediaCaption ?? null,
      scope: parsed.data.scope,
      triggerType: parsed.data.triggerType,
      triggerTerms: parsed.data.triggerTerms.map((t) => t.trim()).filter(Boolean),
      messageText: parsed.data.messageText.trim(),
      dailyLimit: parsed.data.dailyLimit,
      onePerUser: parsed.data.onePerUser,
    });

    return NextResponse.json({ ok: true, rule });
  } catch (err) {
    console.error("[comment-direct/rules] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar a automação." }, { status: 500 });
  }
}
