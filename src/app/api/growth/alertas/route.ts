import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { generateAlerts } from "@/lib/knowledge/alerts";
import { buildProactiveInsights, summarizeChanges } from "@/lib/growth-engine";
import { runGrowthEngine } from "@/lib/growth-engine";
import { toGrowthHttpError } from "@/lib/growth-engine/errors";
import { smartAlertQuerySchema } from "@/lib/validators/growth";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth/alertas?platform=instagram|tiktok
 * Alertas inteligentes (Parte 12): evolui /api/alertas sem duplicar.
 * - `alerts`: alertas determinísticos clássicos (generateAlerts, Fase 4.5).
 * - `signals`: sinais do Growth Engine (se o motor rodar com dados).
 * - `insights`: insights proativos automáticos.
 * - `changes`: resumo do que mudou (deduplicado, sem spam).
 *
 * NÃO persiste nada — recálculo a cada GET (mesmo comportamento de /api/alertas).
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const parsed = smartAlertQuerySchema.safeParse({
      platform: url.searchParams.get("platform") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    }
    const platform = parsed.data.platform;

    // Alertas determinísticos clássicos (por plataforma, ou ambas se não informado).
    const alerts = platform
      ? await generateAlerts(userId, platform)
      : [
          ...(await generateAlerts(userId, "instagram")),
          ...(await generateAlerts(userId, "tiktok")),
        ];

    // Sinais + insights proativos do Growth Engine (dados reais).
    const engine = await runGrowthEngine(userId);
    const signals = engine.signals.filter(
      (s) => !platform || s.platform === null || s.platform === platform
    );
    const insights = buildProactiveInsights(signals);
    const changes = summarizeChanges(engine.context, signals);

    return NextResponse.json({
      platform: platform ?? "ambas",
      alerts,
      signals,
      insights,
      changes,
      confidence: engine.confidence,
    });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/alertas] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}
