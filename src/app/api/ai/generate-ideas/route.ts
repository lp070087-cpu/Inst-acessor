import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateIdeaSchema } from "@/lib/validators/ai";
import { generateIdeas, AIConfiguredErrorIdeas } from "@/lib/ai/services";
import { AIProviderError } from "@/lib/ai";
import { aiRateLimiter } from "@/lib/publishing/rate-limit";
import { grantXp, stableRefId } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate-ideas
 * Gera ideias via IA (sem salvar). Salvar → /api/ideas.
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

    // XP por gerar ideias (idempotente por refId = fingerprint da requisição).
    const refId = stableRefId(
      `ideias:${parsed.data.category}:${ideas.map((i) => i.title).join("|")}`
    );
    await grantXp(userId, "gerar-ideia", refId);

    return NextResponse.json({ ok: true, ideas });
  } catch (err) {
    if (err instanceof AIConfiguredErrorIdeas) {
      return NextResponse.json(
        { error: "IA_NAO_CONFIGURADA", message: "A IA ainda não foi configurada." },
        { status: 503 }
      );
    }
    if (err instanceof AIProviderError) {
      console.error("[ai/generate-ideas] erro do provider", err.code, err.status ?? "");
      const status = err.code === "auth" ? 401 : err.code === "quota" ? 429 : 502;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status }
      );
    }
    console.error("[ai/generate-ideas] erro", err);
    return NextResponse.json(
      { error: "Não foi possível gerar ideias. Tente novamente." },
      { status: 500 }
    );
  }
}
