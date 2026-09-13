import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { sendApprovedReply } from "@/lib/comment-replies/engine";
import { updateLog } from "@/lib/comment-replies/db";
import { approveSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * POST /api/comment-replies/approve
 *
 * Aprova e ENVIA a resposta de um comentário. É o único caminho de envio
 * disparado por ação humana.
 *
 * Garantias:
 *  • o registro precisa pertencer ao usuário (checado no serviço);
 *  • o limite é reavaliado no momento do envio, não no da sugestão;
 *  • `sendApprovedReply` é idempotente — aprovar duas vezes o mesmo comentário
 *    não produz uma segunda resposta no Instagram.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { logId, finalReply } = parsed.data;

    // Sem texto final explícito, usa a sugestão já gerada e registrada.
    let text = finalReply?.trim() ?? "";
    if (!text) {
      const { findLogById } = await import("@/lib/comment-replies/db");
      const log = await findLogById(session.user.id, logId);
      text = log?.generatedReply?.trim() ?? "";
    }
    if (!text) {
      return NextResponse.json({ error: "Não há resposta para enviar." }, { status: 400 });
    }

    const result = await sendApprovedReply(session.user.id, logId, text, "MANUAL");

    if (!result.ok) {
      await updateLog(session.user.id, logId, { status: "ERROR", errorCode: result.code ?? "approve" });
      const status = result.code === "not_found" ? 404 : result.code === "limit" ? 429 : 502;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ ok: true, replyId: result.replyId, finalReply: text });
  } catch (err) {
    console.error("[comment-replies/approve] erro", err);
    return NextResponse.json({ error: "Não foi possível enviar a resposta." }, { status: 500 });
  }
}
