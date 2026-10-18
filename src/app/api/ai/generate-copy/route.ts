import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateCopySchema } from "@/lib/validators/ai";
import { generateCopy, AIConfiguredErrorCopy } from "@/lib/ai/services";
import { createRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * RATE LIMIT POR USUÁRIO — a geração de copy é a operação de MAIOR CUSTO do
 * app: cada chamada aciona o provedor de IA (cobrado por token). Sem limite,
 * um usuário (ou um clique repetido) pode multiplicar o custo sem teto.
 *
 * 30 gerações/min é folgado para o uso legítimo (escrever uma legenda leva
 * segundos) e corta o abuso óbvio. É o mesmo `createRateLimiter` já usado na
 * fila de publicação — in-memory, best-effort; ver a nota sobre limite
 * distribuído no próprio módulo.
 */
const copyRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * POST /api/ai/generate-copy
 * Gera uma copy via IA (sem salvar). Salvar → /api/copy.
 */
async function POSTHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!copyRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas gerações em pouco tempo. Aguarde um instante." },
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

export const POST = withPremiumApi(POSTHandler);
