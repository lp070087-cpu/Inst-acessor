import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/publishing/rate-limit";
import {
  listActions,
  getAction,
  createAction,
  updateActionStatus,
  deleteAction,
  completeActionWithXp,
} from "@/lib/growth-engine";
import { toGrowthHttpError } from "@/lib/growth-engine/errors";
import type { SignalType } from "@/lib/growth-engine";
import {
  createGrowthActionSchema,
  updateGrowthActionSchema,
  growthActionQuerySchema,
} from "@/lib/validators/growth";

export const dynamic = "force-dynamic";

const actionsRateLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

/**
 * /api/growth/actions
 * GET  → lista ações (filtro status)
 * POST → cria ação (deduplicação por sourceRecommendation)
 * PATCH → atualiza status (com XP na conclusão real)
 * DELETE → remove ação (owner-check)
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const parsed = growthActionQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    if (id) {
      const action = await getAction(userId, id);
      if (!action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
      return NextResponse.json({ action });
    }

    const actions = await listActions(userId, parsed.data.status);
    return NextResponse.json({ actions });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/actions] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    if (!actionsRateLimiter.check(userId)) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = createGrowthActionSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const action = await createAction(userId, {
      platform: parsed.data.platform,
      title: parsed.data.title,
      description: parsed.data.description,
      reason: parsed.data.reason,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt,
      sourceSignal: (parsed.data.sourceSignal as SignalType | null) ?? undefined,
      sourceRecommendation: parsed.data.sourceRecommendation,
      metricToWatch: parsed.data.metricToWatch,
      baselineValue: parsed.data.baselineValue,
    });
    return NextResponse.json({ action }, { status: 201 });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/actions] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const body = await request.json();
    const parsed = updateGrowthActionSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Conclusão real concede XP (idempotente).
    if (parsed.data.status === "COMPLETED") {
      const result = await completeActionWithXp(userId, id, {
        resultValue: parsed.data.resultValue ?? undefined,
        resultNote: parsed.data.resultNote ?? undefined,
      });
      if (!result.action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
      return NextResponse.json({ action: result.action, xp: result.xp });
    }

    const action = await updateActionStatus(userId, id, parsed.data.status);
    if (!action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
    return NextResponse.json({ action });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/actions] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const ok = await deleteAction(userId, id);
    if (!ok) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const http = toGrowthHttpError(err);
    console.error("[growth/actions] erro", err);
    return NextResponse.json({ error: http.message, code: http.code }, { status: http.status });
  }
}
