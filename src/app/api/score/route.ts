import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { scorePlatformSchema } from "@/lib/validators/ai";
import { computeScore, persistScore, getScoreHistory } from "@/lib/ai/services";
import { scoreHistoryGate } from "@/lib/ai/services/score-gate";

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

    // A REGRA de "pode registrar?" mora em `score-gate.ts` e é a MESMA que o
    // cliente usa — servidor e tela não podem discordar sobre o que é um Score
    // registrável. Aqui o histórico vai vazio de propósito: ao gravar, um valor
    // repetido NÃO é bloqueio (é um snapshot novo, com data nova, e é isso que
    // o botão promete). O cliente bloqueia a repetição para não poluir o card.
    const gate = scoreHistoryGate(score, []);

    // `persistScore` já tem a guarda interna (overall != null && scoreAvailable)
    // e é ele quem garante que nada inválido entra no histórico.
    const persisted = await persistScore(userId, score);

    // O delegate genérico de `ai.score` não infere a linha criada (é
    // `Delegate<T>`), então o cast é explícito e restrito a estes 3 campos.
    const row = persisted as unknown as { id?: string; createdAt?: Date; overall?: number } | null;

    return NextResponse.json({
      ok: true,
      score,
      persisted: persisted != null,
      // Linha REAL gravada (id e horário do BANCO): antes o cliente inventava
      // um `h-${Date.now()}` no fuso do navegador e o item aparecia, sumia ao
      // recarregar a página e dava a impressão de que nada fora salvo.
      persistedRow:
        persisted != null
          ? {
              id: row?.id ?? null,
              overall: row?.overall ?? score.overall,
              createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
            }
          : null,
      // Motivo explícito do bloqueio, quando há um (item 4).
      reason: gate.canPersist ? null : gate.message,
    });
  } catch (err) {
    console.error("[score] erro ao persistir", err);
    return NextResponse.json({ error: "Não foi possível calcular o Score." }, { status: 500 });
  }
}
