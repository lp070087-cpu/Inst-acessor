import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  createPlannedContentSchema,
  updatePlannedContentSchema,
} from "@/lib/validators/planning";
import {
  listPlannedContent,
  createPlannedContent,
  updatePlannedContent,
  deletePlannedContent,
} from "@/lib/planning";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * FASE 6 — API DO CALENDÁRIO / PIPELINE DE CONTEÚDO
 * ==================================================
 * GET    /api/calendar — lista conteúdos planejados (filtros)
 * POST   /api/calendar — cria um conteúdo planejado
 * PATCH  /api/calendar?id=... — atualiza (reagenda, muda status, associa)
 * DELETE /api/calendar?id=... — exclui
 * POST   /api/calendar/duplicate?id=... — duplica
 *
 * Todas as rotas são session-required + owner-checked (userId da sessão).
 */

function toJson(row: {
  id: string;
  platform: string;
  format: string;
  title: string;
  theme: string | null;
  objective: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  notes: string | null;
  hypothesis: string | null;
  ideaId: string | null;
  copyId: string | null;
  draftId: string | null;
  goalId: string | null;
  experimentIds: string[];
  copyVersionCount: number;
  ideaTitle: string | null;
  copyContent: string | null;
  draftCaption: string | null;
  goalTitle: string | null;
  experimentTitles: string[];
  createdAt: string;
}) {
  return {
    id: row.id,
    platform: row.platform,
    format: row.format,
    title: row.title,
    theme: row.theme ?? "",
    objective: row.objective ?? "",
    status: row.status,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    externalId: row.externalId,
    notes: row.notes ?? "",
    hypothesis: row.hypothesis ?? "",
    ideaId: row.ideaId,
    copyId: row.copyId,
    draftId: row.draftId,
    goalId: row.goalId,
    experimentIds: row.experimentIds,
    copyVersionCount: row.copyVersionCount,
    ideaTitle: row.ideaTitle ?? "",
    copyContent: row.copyContent ?? "",
    draftCaption: row.draftCaption ?? "",
    goalTitle: row.goalTitle ?? "",
    experimentTitles: row.experimentTitles,
    createdAt: row.createdAt,
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform") ?? undefined;
    const format = url.searchParams.get("format") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const objective = url.searchParams.get("objective") ?? undefined;
    const experimentId = url.searchParams.get("experimentId") ?? undefined;
    const goalId = url.searchParams.get("goalId") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const rows = await listPlannedContent(userId, {
      platform,
      format,
      status,
      objective,
      experimentId,
      goalId,
      from,
      to,
    });

    return NextResponse.json(rows.map(toJson));
  } catch (err) {
    console.error("[calendar] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar o calendário." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = createPlannedContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const created = await createPlannedContent(userId, {
      platform: d.platform,
      format: d.format,
      title: d.title,
      theme: d.theme || undefined,
      objective: d.objective || undefined,
      scheduledAt: d.scheduledAt,
      notes: d.notes || undefined,
      hypothesis: d.hypothesis || undefined,
      ideaId: d.ideaId,
      copyId: d.copyId,
      draftId: d.draftId,
      goalId: d.goalId,
    });

    // XP por ação real: criar conteúdo planejado (idempotente).
    await grantXp(userId, "planejar-conteudo", created.id);
    await checkAndUnlockAchievements(userId);

    return NextResponse.json({ ok: true, content: toJson(created) });
  } catch (err) {
    console.error("[calendar] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar o conteúdo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = await request.json();
    const parsed = updatePlannedContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const updated = await updatePlannedContent(userId, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, content: toJson(updated) });
  } catch (err) {
    console.error("[calendar] erro ao atualizar", err);
    return NextResponse.json({ error: "Erro ao atualizar conteúdo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const ok = await deletePlannedContent(userId, id);
    if (!ok) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[calendar] erro ao excluir", err);
    return NextResponse.json({ error: "Erro ao excluir conteúdo." }, { status: 500 });
  }
}

