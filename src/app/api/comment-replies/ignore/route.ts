import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { findLogById, updateLog } from "@/lib/comment-replies/db";
import { ignoreSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-replies/ignore
 *
 * Marca um comentário como IGNORADO. O registro permanece no histórico — é o
 * que impede que a automação volte a sugerir resposta para o mesmo comentário
 * (a idempotência depende de o registro existir, não de ser apagado).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = ignoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const log = await findLogById(session.user.id, parsed.data.logId);
    if (!log) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }

    // Nunca sobrescreve um envio já concluído — histórico é imutável.
    if (log.status === "SENT") {
      return NextResponse.json(
        { error: "Esta resposta já foi enviada e não pode ser ignorada." },
        { status: 409 }
      );
    }

    const updated = await updateLog(session.user.id, parsed.data.logId, {
      status: "IGNORED",
    });

    return NextResponse.json({ ok: true, log: updated });
  } catch (err) {
    console.error("[comment-replies/ignore] erro", err);
    return NextResponse.json({ error: "Não foi possível ignorar o comentário." }, { status: 500 });
  }
}
