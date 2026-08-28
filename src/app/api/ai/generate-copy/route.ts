import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateCopySchema } from "@/lib/validators/ai";
import { generateCopy, AIConfiguredErrorCopy } from "@/lib/ai/services";
import { aiRateLimiter } from "@/lib/publishing/rate-limit";
import { grantXp, stableRefId } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate-copy
 * Gera uma copy via IA (sem salvar). Salvar → /api/copy.
 * Rate limit por usuário (evita abuso de custo de IA).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!aiRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas solicitações. Aguarde um instante e tente novamente." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = generateCopySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { platform, format, objective, tone, audience, context, size } = parsed.data;
    const content = await generateCopy(userId, {
      platform,
      format,
      objective: objective || undefined,
      tone: tone || undefined,
      audience: audience || undefined,
      context: context || undefined,
      size,
    });

    // XP por gerar copy (idempotente por refId = fingerprint do conteúdo).
    const refId = stableRefId(`${platform}:${format}:${objective}:${content}`);
    await grantXp(userId, "gerar-copy", refId);

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    if (err instanceof AIConfiguredErrorCopy) {
      return NextResponse.json(
        { error: "IA_NAO_CONFIGURADA", message: "A IA ainda não foi configurada." },
        { status: 503 }
      );
    }
    console.error("[ai/generate-copy] erro", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a copy. Tente novamente." },
      { status: 500 }
    );
  }
}
