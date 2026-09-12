import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { lookupFirstAccess } from "@/lib/first-access";
import { createRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const lookupRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * GET /api/first-access/lookup?email=...
 * Consulta, para um usuário AUTENTICADO, se o e-mail tem acesso liberado.
 * Usado pela tela de boas-vindas pós-verificação.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!lookupRateLimiter.check(session.user.id)) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";

  const result = await lookupFirstAccess(email);
  // Segurança: mesmo autenticado, só devolve elegibilidade (sem dados de terceiros).
  return NextResponse.json({
    ok: result.ok,
    eligible: result.eligible,
    grant: result.grant,
  });
}
