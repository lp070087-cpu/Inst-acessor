import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { createRateLimiter } from "@/lib/publishing/rate-limit";
import { adminUserStatusSchema } from "@/lib/validators/admin";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";

export const dynamic = "force-dynamic";

const adminUsersRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * GET /api/admin/users?q=...&limit=...
 * Lista usuários (somente ADMIN). Busca opcional por nome/e-mail.
 */
export async function GET(request: Request) {
  await requireAdminSession();

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 200);

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: { subscriptions: true, connections: true },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users] erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os usuários." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Ações sobre um usuário (somente ADMIN): suspender/ativar/tornar admin/remover admin.
 *
 * Proteções:
 * - Nunca é possível suspender/alterar a si mesmo.
 * - Nunca é possível alterar o papel de um ADMIN (exceto promover, que é
 *   permitido — porém sem poder rebaixar outro admin).
 */
export async function POST(request: Request) {
  const { session } = await requireAdminSession();
  const adminId = session.user.id;

  if (!adminUsersRateLimiter.check(adminId)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um instante." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = adminUserStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { userId, action } = parsed.data;

  // Nunca alterar a si mesmo.
  if (userId === adminId) {
    return NextResponse.json(
      { error: "Você não pode alterar o próprio acesso." },
      { status: 400 }
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // ⚠️ ADMIN ÚNICO E EXCLUSIVO — nunca é possível criar outro administrador.
    // A autorização administrativa é definida por e-mail (isOfficialAdminEmail),
    // não pela role no banco. `make-admin` é bloqueado para TODOS.
    if (action === "make-admin") {
      return NextResponse.json(
        { error: "Não é possível criar outro administrador. O acesso administrativo é exclusivo." },
        { status: 400 }
      );
    }

    const targetIsOfficialAdmin = isOfficialAdminEmail(target.email);

    switch (action) {
      case "suspend":
        // Nunca suspender o administrador oficial.
        if (targetIsOfficialAdmin) {
          return NextResponse.json(
            { error: "Não é possível suspender o administrador." },
            { status: 400 }
          );
        }
        await prisma.user.update({
          where: { id: userId },
          data: { status: "SUSPENDED" },
        });
        break;
      case "activate":
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        });
        break;
      case "remove-admin":
        // Remove o papel ADMIN de usuários com e-mail NÃO oficial (admins
        // legados com role no banco, mas sem privilégio real). O administrador
        // oficial nunca é rebaixado.
        if (targetIsOfficialAdmin) {
          return NextResponse.json(
            { error: "Não é possível remover o papel do administrador." },
            { status: 400 }
          );
        }
        await prisma.user.update({
          where: { id: userId },
          data: { role: "USER" },
        });
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users] erro", err);
    return NextResponse.json(
      { error: "Não foi possível atualizar o usuário." },
      { status: 500 }
    );
  }
}
