import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { deleteSpecialProfile, updateSpecialProfile } from "@/lib/comment-replies/db";
import { updateSpecialProfileSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/** PATCH /api/comment-replies/special-profiles/[id] */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = updateSpecialProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const profile = await updateSpecialProfile(session.user.id, params.id, parsed.data);
    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[comment-replies/special-profiles/:id] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível atualizar o perfil." }, { status: 500 });
  }
}

/** DELETE /api/comment-replies/special-profiles/[id] */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const ok = await deleteSpecialProfile(session.user.id, params.id);
    if (!ok) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-replies/special-profiles/:id] erro ao remover", err);
    return NextResponse.json({ error: "Não foi possível remover o perfil." }, { status: 500 });
  }
}
