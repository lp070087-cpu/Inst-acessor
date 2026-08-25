import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validators/auth";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado. Faça login." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json(
      { user, ok: true },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado. Faça login." },
          { status: 409 }
        );
      }
    }
    console.error("register error", error);
    return NextResponse.json(
      { error: "Não foi possível criar sua conta. Tente novamente." },
      { status: 500 }
    );
  }
}
