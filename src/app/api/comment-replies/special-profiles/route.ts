import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { createSpecialProfile, listSpecialProfiles } from "@/lib/comment-replies/db";
import { createSpecialProfileSchema } from "@/lib/validators/comment-replies";

export const dynamic = "force-dynamic";

/**
 * Perfis especiais (@amiga, @clientevip, @parceira, @empresa...).
 *
 * O sistema NÃO infere gênero, intimidade ou relação a partir do @. Tudo o que
 * a IA sabe sobre a pessoa vem de `customInstructions` e, opcionalmente, de
 * uma resposta fixa — ambos escritos pelo usuário.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const profiles = await listSpecialProfiles(session.user.id);
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("[comment-replies/special-profiles] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar os perfis." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createSpecialProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const profile = await createSpecialProfile(session.user.id, parsed.data);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error("[comment-replies/special-profiles] erro ao criar", err);
    // Violação do @@unique([userId, instagramUsername]) — perfil já cadastrado.
    const message =
      err instanceof Error && /unique/i.test(err.message)
        ? "Este perfil já está cadastrado."
        : "Não foi possível salvar o perfil.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
