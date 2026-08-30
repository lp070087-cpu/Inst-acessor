import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  recomputeGoalProgress,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
} from "@/lib/gamification";
import type { GoalCategory } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * API de Metas (Fase 5):
 *   GET    /api/rank/metas            → lista metas + recalculada
 *   POST   /api/rank/metas            → cria meta (crescimento/engajamento/consistência)
 *   PATCH  /api/rank/metas?id=...     → atualiza meta (owner-check)
 *   DELETE /api/rank/metas?id=...     → exclui meta (owner-check)
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Recalcula progresso real e conclui metas atingidas (concede XP UMA vez).
    const recomputed = await recomputeGoalProgress(userId);

    return NextResponse.json({
      goals: recomputed.goals,
      completedNow: recomputed.completedNow,
      categories: GOAL_CATEGORIES,
      statuses: GOAL_STATUSES,
    });
  } catch (err) {
    console.error("[rank/metas] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as metas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

    const category = str(body.category) as GoalCategory | undefined;
    const title = str(body.title);
    if (!category || !GOAL_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: "título é obrigatório" }, { status: 400 });

    const targetValue = num(body.targetValue);
    const deadline = body.deadline ? new Date(str(body.deadline)!) : undefined;

    const goal = await createGoal(userId, {
      category,
      title,
      description: str(body.description),
      targetValue: targetValue,
      unit: str(body.unit),
      platform: str(body.platform),
      deadline: deadline,
    });

    return NextResponse.json({ ok: true, goal });
  } catch (err) {
    console.error("[rank/metas] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar a meta." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

    const category = str(body.category) as GoalCategory | undefined;
    const status = str(body.status);
    if (status && !(GOAL_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const updated = await updateGoal(userId, id, {
      ...(category && GOAL_CATEGORIES.includes(category) ? { category } : {}),
      ...(str(body.title) ? { title: str(body.title)! } : {}),
      ...(body.description !== undefined ? { description: str(body.description) ?? null } : {}),
      ...(body.targetValue !== undefined ? { targetValue: num(body.targetValue) ?? null } : {}),
      ...(body.unit !== undefined ? { unit: str(body.unit) ?? null } : {}),
      ...(body.platform !== undefined ? { platform: str(body.platform) ?? null } : {}),
      ...(status ? { status: status as "ATIVA" | "CONCLUIDA" | "CANCELADA" } : {}),
      ...(body.deadline !== undefined
        ? { deadline: body.deadline ? new Date(str(body.deadline)!) : null }
        : {}),
    });

    if (!updated) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, goal: updated });
  } catch (err) {
    console.error("[rank/metas] erro ao atualizar", err);
    return NextResponse.json({ error: "Erro ao atualizar meta." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deleteGoal(userId, id);
    if (!ok) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rank/metas] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir meta." }, { status: 500 });
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
