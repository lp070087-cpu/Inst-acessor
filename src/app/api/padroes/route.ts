import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  listInsights,
  createInsight,
  deleteInsight,
  discoverObservedPatterns,
} from "@/lib/knowledge/patterns";
import { scorePlatformSchema } from "@/lib/validators/ai";

export const dynamic = "force-dynamic";

/**
 * API de padrões/aprendizado do perfil (Fase 4.5):
 *   GET  /api/padroes?platform=...        → insights salvos + padrões observados
 *   POST /api/padroes                     → cria insight (OBSERVED/INFERRED/CONFIRMED_BY_EXPERIMENT)
 *   DELETE /api/padroes?id=...            → remove
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

    const [insights, observed] = await Promise.all([
      listInsights(userId, platform),
      discoverObservedPatterns(userId, platform),
    ]);

    return NextResponse.json({ platform, insights, observed });
  } catch (err) {
    console.error("[padroes] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar padrões." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

    const platform = scorePlatformSchema.safeParse(body.platform);
    if (!platform.success) {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    const type = typeof body.type === "string" ? body.type : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    if (!["OBSERVED", "INFERRED", "CONFIRMED_BY_EXPERIMENT"].includes(type) || !summary) {
      return NextResponse.json({ error: "tipo e resumo são obrigatórios" }, { status: 400 });
    }

    const insight = await createInsight(userId, {
      platform: platform.data,
      type: type as "OBSERVED" | "INFERRED" | "CONFIRMED_BY_EXPERIMENT",
      summary,
      detail: typeof body.detail === "string" ? body.detail : undefined,
      ruleSlug: typeof body.ruleSlug === "string" ? body.ruleSlug : undefined,
      experimentId: typeof body.experimentId === "string" ? body.experimentId : undefined,
      confidence:
        body.confidence === "ALTA" || body.confidence === "MEDIA" || body.confidence === "BAIXA"
          ? body.confidence
          : undefined,
    });
    if (!insight) return NextResponse.json({ error: "insight inválido" }, { status: 400 });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[padroes] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar padrão." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const ok = await deleteInsight(userId, id);
    if (!ok) return NextResponse.json({ error: "padrão não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[padroes] erro ao excluir", err);
    return NextResponse.json({ error: "Não foi possível excluir padrão." }, { status: 500 });
  }
}
