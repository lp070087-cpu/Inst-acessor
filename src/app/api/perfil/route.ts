import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * PERFIL — Atualiza os dados pessoais do usuário autenticado.
 *
 * - Owner-check: usa `session.user.id` — ninguém edita perfil de outro usuário.
 * - Validação Zod no servidor.
 * - Upsert no `UserProfile` (mantém `onboardingCompleted` intacto).
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { displayName, username, niche, subNiche, objective } = parsed.data;

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: displayName || null,
        username: username || null,
        niche: niche || null,
        subNiche: subNiche || null,
        objective: objective || null,
      },
      update: {
        displayName: displayName || null,
        username: username || null,
        niche: niche || null,
        subNiche: subNiche || null,
        objective: objective || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("perfil error", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o perfil. Tente novamente." },
      { status: 500 }
    );
  }
}
