import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { applyWeeklyPlanDay } from "@/lib/planning";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** 0 = Domingo … 6 = Sábado. */
  weekday: z.number().int().min(0).max(6),
  /** Data/hora ISO opcional para já agendar. Nunca inferida pelo servidor. */
  scheduledAt: z.string().nullable().optional(),
});

/**
 * POST /api/calendar/weekly-plan/apply
 * ====================================
 * Aceita a sugestão de UM dia do plano semanal e a persiste em `PlannedContent`
 * (mesmo modelo do calendário). A sugestão é RECALCULADA no servidor a partir
 * do plano real; o cliente só diz QUAL dia. Dedup por marcador de semana —
 * clicar de novo não duplica. Session-required + owner-checked.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const result = await applyWeeklyPlanDay({
      userId,
      weekday: parsed.data.weekday,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // XP por ação real (idempotente por id do conteúdo) — só quando criou algo.
    if (result.created) {
      await grantXp(userId, "planejar-conteudo", result.content.id);
      await checkAndUnlockAchievements(userId);
    }

    return NextResponse.json({
      ok: true,
      created: result.created,
      alreadyExisted: result.alreadyExisted,
      content: result.content,
    });
  } catch (err) {
    console.error("[weekly-plan/apply] erro", err);
    return NextResponse.json(
      { error: "Não foi possível aplicar a sugestão." },
      { status: 500 }
    );
  }
}
