import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  createExperiment,
  listExperiments,
  getExperiment,
  updateExperimentStatus,
  addVariant,
  addObservation,
  deleteExperiment,
} from "@/lib/knowledge/experiments";
import { scorePlatformSchema } from "@/lib/validators/ai";

export const dynamic = "force-dynamic";

/**
 * API de experimentos (Fase 4.5):
 *   GET    /api/experimentos            → lista (por usuário)
 *   POST   /api/experimentos            → cria (status DRAFT)
 *   GET    /api/experimentos?id=...     → detalhe + variantes + observações
 *   PATCH  /api/experimentos?id=...&status=... → muda status
 *   POST   /api/experimentos/variante?id=...   → adiciona variante
 *   POST   /api/experimentos/observacao?id=... → adiciona observação
 *   DELETE /api/experimentos?id=...     → remove
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const exp = await getExperiment(userId, id);
      if (!exp) return NextResponse.json({ error: "experimento não encontrado" }, { status: 404 });
      return NextResponse.json({ experiment: exp });
    }

    const experiments = await listExperiments(userId);
    return NextResponse.json({ experiments });
  } catch (err) {
    console.error("[experimentos] erro", err);
    return NextResponse.json({ error: "Não foi possível listar experimentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const variant = url.pathname.includes("/variante");
    const observation = url.pathname.includes("/observacao");

    if (variant || observation) {
      const experimentId = url.searchParams.get("id");
      if (!experimentId) {
        return NextResponse.json({ error: "experimento obrigatório" }, { status: 400 });
      }
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

      if (variant) {
        const created = await addVariant(userId, experimentId, {
          contentId: str(body.contentId),
          variation: str(body.variation),
          hookType: str(body.hookType),
          format: str(body.format),
          theme: str(body.theme),
          structure: str(body.structure),
        });
        if (!created) return NextResponse.json({ error: "experimento não encontrado" }, { status: 404 });
        return NextResponse.json({ variant: created });
      }

      const created = await addObservation(userId, experimentId, {
        metric: str(body.metric) ?? "",
        before: num(body.before),
        after: num(body.after),
        delta: num(body.delta),
        conclusion: str(body.conclusion),
        confidence: (str(body.confidence) as "BAIXA" | "MEDIA" | "ALTA") ?? undefined,
      });
      if (!created) return NextResponse.json({ error: "experimento não encontrado" }, { status: 404 });
      return NextResponse.json({ observation: created });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

    const platform = scorePlatformSchema.safeParse(body.platform);
    if (!platform.success) {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }
    const hypothesis = str(body.hypothesis);
    const variable = str(body.variable);
    if (!hypothesis || !variable) {
      return NextResponse.json({ error: "hipótese e variável são obrigatórias" }, { status: 400 });
    }

    const experiment = await createExperiment(userId, {
      platform: platform.data,
      hypothesis,
      variable,
      baseline: str(body.baseline),
    });
    return NextResponse.json({ experiment });
  } catch (err) {
    console.error("[experimentos] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar experimento." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    if (!id || !status) {
      return NextResponse.json({ error: "id e status são obrigatórios" }, { status: 400 });
    }

    const experiment = await updateExperimentStatus(userId, id, status);
    if (!experiment) return NextResponse.json({ error: "experimento não encontrado" }, { status: 404 });
    return NextResponse.json({ experiment });
  } catch (err) {
    console.error("[experimentos] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível atualizar experimento." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const ok = await deleteExperiment(userId, id);
    if (!ok) return NextResponse.json({ error: "experimento não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[experimentos] erro ao excluir", err);
    return NextResponse.json({ error: "Não foi possível excluir experimento." }, { status: 500 });
  }
}

// ------------------------------------------------------------
// Helpers de parsing (sem `any`)
// ------------------------------------------------------------
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
