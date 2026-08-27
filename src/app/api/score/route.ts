import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { scorePlatformSchema } from "@/lib/validators/ai";
import { computeScore, persistScore, getScoreHistory } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * GET  /api/score?platform=instagram|tiktok — calcula o Score + histórico
 * POST /api/score?platform=... — calcula e persiste (ProfileScore + snapshot)
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = scorePlatformSchema.safeParse(url.searchParams.get("platform"));
    if (!parsed.success) {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    const platform = parsed.data;

    const [score, history] = await Promise.all([
      computeScore(userId, platform),
      getScoreHistory(userId, platform),
    ]);

    return NextResponse.json({
      platform,
      score,
      history: history.map((h) => ({
        id: h.id,
        overall: h.overall,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[score] erro", err);
    return NextResponse.json({ error: "Não foi possível calcular o Score." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = scorePlatformSchema.safeParse(url.searchParams.get("platform"));
    if (!parsed.success) {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    const platform = parsed.data;

    const score = await computeScore(userId, platform);
    const persisted = score.overall != null ? await persistScore(userId, score) : null;

    return NextResponse.json({
      ok: true,
      score,
      persisted: persisted != null,
    });
  } catch (err) {
    console.error("[score] erro ao persistir", err);
    return NextResponse.json({ error: "Não foi possível calcular o Score." }, { status: 500 });
  }
}
