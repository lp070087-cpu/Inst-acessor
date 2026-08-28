import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validators/auth";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { objective, niche, subNiche } = parsed.data;

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        objective,
        niche,
        subNiche: subNiche || null,
        onboardingCompleted: true,
      },
      update: {
        objective,
        niche,
        subNiche: subNiche || null,
        onboardingCompleted: true,
      },
    });

    // XP por concluir onboarding (idempotente por refId = userId).
    await grantXp(userId, "concluir-onboarding", userId);
    await checkAndUnlockAchievements(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("onboarding error", error);
    return NextResponse.json(
      { error: "Não foi possível salvar seu perfil. Tente novamente." },
      { status: 500 }
    );
  }
}
