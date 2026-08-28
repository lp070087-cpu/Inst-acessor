import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { updateRecommendationSchema } from "@/lib/validators/ai";
import {
  listRecommendations,
  generateRecommendations,
  updateRecommendationStatus,
  type MentorshipCard,
} from "@/lib/ai/services";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * GET   /api/mentoria?platform=instagram|tiktok — lista recomendações
 * POST  /api/mentoria?platform=... — gera recomendações a partir do diagnóstico
 * PATCH /api/mentoria?id=...&status=... — atualiza status
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = await listRecommendations(userId);
    const serialized = rows.map(serializeCard);
    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[mentoria] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as recomendações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");
    if (platform !== "instagram" && platform !== "tiktok") {
      return NextResponse.json({ error: "plataforma inválida" }, { status: 400 });
    }

    const created = await generateRecommendations(userId, platform);
    return NextResponse.json({ ok: true, cards: created.map(serializeCard) });
  } catch (err) {
    console.error("[mentoria] erro ao gerar", err);
    return NextResponse.json({ error: "Não foi possível gerar recomendações." }, { status: 500 });
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
    const parsed = updateRecommendationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const updated = await updateRecommendationStatus(userId, id, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: "Recomendação não encontrada" }, { status: 404 });
    }

    // XP por executar recomendação (idempotente por source+refId = rec id).
    if (parsed.data.status === "APLICADA" || parsed.data.status === "CONCLUIDA") {
      await grantXp(userId, "executar-recomendacao", id);
      await checkAndUnlockAchievements(userId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mentoria] erro ao atualizar", err);
    return NextResponse.json({ error: "Erro ao atualizar recomendação." }, { status: 500 });
  }
}

function serializeCard(c: MentorshipCard) {
  return {
    id: c.id,
    category: c.category,
    label: c.label,
    priority: c.priority,
    problem: c.problem,
    explanation: c.explanation,
    action: c.action,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  };
}
