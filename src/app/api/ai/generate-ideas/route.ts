import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateIdeaSchema } from "@/lib/validators/ai";
import { generateIdeas, AIConfiguredErrorIdeas } from "@/lib/ai/services";
import { createRateLimiter } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * RATE LIMIT POR USUÁRIO — geração de ideias também aciona o provedor de IA
 * (custo por token). Mesmo racional da rota de copy: 30/min cobre o uso
 * legítimo e corta o abuso. In-memory, best-effort.
 */
const ideasRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * POST /api/ai/generate-ideas
 * Gera ideias via IA (sem salvar). Salvar → /api/ideas.
 */
async function POSTHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!ideasRateLimiter.check(userId)) {
      return NextResponse.json(
        { error: "Muitas gerações em pouco tempo. Aguarde um instante." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = generateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const ideas = await generateIdeas(userId, {
      category: parsed.data.category,
      count: parsed.data.count,
    });

    return NextResponse.json({ ok: true, ideas });
  } catch (err) {
    if (err instanceof AIConfiguredErrorIdeas) {
      return NextResponse.json(
        { error: "IA_NAO_CONFIGURADA", message: "A IA ainda não foi configurada." },
        { status: 503 }
      );
    }
    console.error("[ai/generate-ideas] erro", err);
    return NextResponse.json(
      { error: "Não foi possível gerar ideias. Tente novamente." },
      { status: 500 }
    );
  }
}

export const POST = withPremiumApi(POSTHandler);
