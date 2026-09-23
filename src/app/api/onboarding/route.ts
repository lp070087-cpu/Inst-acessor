import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validators/auth";

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

    // Campo não respondido vira `null`, NUNCA string vazia.
    //
    // `objective: ""` no banco seria um valor que parece informação e não é —
    // quem lê (inclusive a IA) não teria como distinguir "o usuário não
    // respondeu" de "o usuário respondeu em branco". `null` é ausência de dado,
    // que é exatamente o que aconteceu quando a pessoa pulou a pergunta.
    const objectiveValue = objective?.trim() || null;
    const nicheValue = niche?.trim() || null;
    const subNicheValue = subNiche?.trim() || null;

    // `onboardingCompleted: true` mesmo com tudo em branco. Lembre-se do motivo:
    // pular é uma resposta legítima. Gravar `false` aqui faria o guard de
    // onboarding devolver o usuário para esta tela em laço, que é exatamente o
    // bloqueio de acesso que a pergunta opcional não pode causar.
    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        objective: objectiveValue,
        niche: nicheValue,
        subNiche: subNicheValue,
        onboardingCompleted: true,
      },
      update: {
        objective: objectiveValue,
        niche: nicheValue,
        subNiche: subNicheValue,
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("onboarding error", error);
    return NextResponse.json(
      { error: "Não foi possível salvar seu perfil. Tente novamente." },
      { status: 500 }
    );
  }
}
