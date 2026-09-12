import { NextResponse } from "next/server";

import { verifyFirstAccessTokenSchema } from "@/lib/validators/first-access";
import { verifyFirstAccessToken } from "@/lib/first-access";
import { createRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const verifyTokenRateLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

/**
 * POST /api/first-access/verify
 * ETAPA 2 — valida o token de uso único e devolve o e-mail + dados do grant.
 *
 * Segurança:
 *   - Rate limit por IP (proteção anti-brute-force do token).
 *   - O token é comparado por hash (nunca em claro).
 *   - Consumido apenas na criação de conta/senha (replay-safe).
 *   - Resposta nunca inclui passwordHash/tokens.
 */
export async function POST(request: Request) {
  if (!verifyTokenRateLimiter.check(clientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Link inválido." }, { status: 400 });
  }

  const parsed = verifyFirstAccessTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Link inválido." }, { status: 400 });
  }

  const result = await verifyFirstAccessToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message ?? "Link inválido." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    email: result.email,
    userExists: result.userExists,
    grant: result.grant,
  });
}
