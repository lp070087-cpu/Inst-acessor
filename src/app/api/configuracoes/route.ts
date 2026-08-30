import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { updatePreferencesSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * CONFIGURAÇÕES — Atualiza as preferências da conta do usuário autenticado.
 *
 * - Owner-check: usa `session.user.id`.
 * - Validação Zod no servidor (idioma + fuso horário fechados).
 * - Upsert no `UserPreferences`.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = updatePreferencesSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { locale, timezone } = parsed.data;

    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, locale, timezone },
      update: { locale, timezone },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("configuracoes error", error);
    return NextResponse.json(
      { error: "Não foi possível salvar as preferências. Tente novamente." },
      { status: 500 }
    );
  }
}
