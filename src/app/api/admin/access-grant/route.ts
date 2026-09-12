import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/publishing/rate-limit";
import { grantManualAccess } from "@/lib/billing/manual-access";
import { adminGrantAccessSchema } from "@/lib/validators/admin";

export const dynamic = "force-dynamic";

const adminGrantRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * POST /api/admin/access-grant
 * Libera/estende acesso manualmente para um e-mail (somente ADMIN).
 *
 * Segurança:
 *   - `requireAdminSession` no servidor (nunca confia em role do frontend).
 *   - Se o e-mail não tem conta → NÃO cria usuário com senha falsa; retorna
 *     USER_NOT_FOUND (criação fica para a fase futura de primeiro acesso).
 *   - Não toca em dados de pagamento Asaas.
 *   - Registra origem ADMIN_MANUAL, quem executou, início e expiração.
 */
export async function POST(request: Request) {
  const { session } = await requireAdminSession();
  const adminId = session.user.id;

  if (!adminGrantRateLimiter.check(adminId)) {
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

  const parsed = adminGrantAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const result = await grantManualAccess({
    email: parsed.data.email,
    days: parsed.data.days,
    adminId,
  });

  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "INVALID_DAYS"
          ? 400
          : 500;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, result });
}
