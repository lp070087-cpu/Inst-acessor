import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteTemplate, updateTemplate } from "@/lib/comment-replies/db";
import { updateTemplateSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/** PATCH /api/comment-replies/templates/[id] — edita um template do usuário. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const template = await updateTemplate(session.user.id, params.id, parsed.data);
    if (!template) {
      return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (err) {
    console.error("[comment-replies/templates/:id] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível atualizar a resposta." }, { status: 500 });
  }
}

/** DELETE /api/comment-replies/templates/[id] — remove um template do usuário. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const ok = await deleteTemplate(session.user.id, params.id);
    if (!ok) {
      return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-replies/templates/:id] erro ao remover", err);
    return NextResponse.json({ error: "Não foi possível remover a resposta." }, { status: 500 });
  }
}
