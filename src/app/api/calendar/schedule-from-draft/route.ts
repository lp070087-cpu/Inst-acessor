import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { scheduleFromDraft } from "@/lib/planning";
import { z } from "zod";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  draftId: z.string().min(1, "Rascunho é obrigatório"),
  platform: z.enum(["instagram", "tiktok"]),
  format: z.string().min(1),
  title: z.string().min(1).max(200),
  objective: z.string().max(120).optional().default(""),
  scheduledAtList: z
    .array(z.string().min(1))
    .min(1, "Informe ao menos uma data/horário")
    .max(30, "Máximo de 30 agendamentos por lote"),
  ideaId: z.string().nullable().optional(),
  copyId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
});

/**
 * POST /api/calendar/schedule-from-draft
 * Cria um ou mais PlannedContent a partir de um rascunho do Preview Social.
 * Session-required + owner-check do rascunho. Agendamento INTERNO apenas.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const result = await scheduleFromDraft({
      userId,
      draftId: parsed.data.draftId,
      platform: parsed.data.platform,
      format: parsed.data.format,
      title: parsed.data.title,
      objective: parsed.data.objective,
      scheduledAtList: parsed.data.scheduledAtList,
      ideaId: parsed.data.ideaId,
      copyId: parsed.data.copyId,
      goalId: parsed.data.goalId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Erro ao agendar." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, created: result.created, contents: result.contents });
  } catch (err) {
    console.error("[schedule-from-draft] erro ao agendar", err);
    return NextResponse.json({ error: "Erro ao agendar." }, { status: 500 });
  }
}
