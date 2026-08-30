import { NextResponse } from "next/server";

import { createFirstAccessSchema } from "@/lib/validators/first-access";
import { createFirstAccessAccount } from "@/lib/first-access";
import { createRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const completeRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/**
 * POST /api/first-access/complete
 * ETAPA 3 — cria a conta com a senha escolhida pelo cliente e marca o
 * primeiro acesso concluído (consome o token de uso único).
 *
 * Segurança:
 *   - Rate limit por IP (proteção anti-brute-force de criação de conta).
 *   - Nunca gera senha automática; o cliente escolhe a senha (mín. 8).
 *   - Token de uso único consumido (replay-safe).
 *   - Resposta nunca inclui passwordHash/tokens.
 *   - Se o User já existe, apenas vincula (não duplica).
 */
export async function POST(request: Request) {
  if (!completeRateLimiter.check(clientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = createFirstAccessSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const result = await createFirstAccessAccount({
    token: parsed.data.token,
    password: parsed.data.password,
    confirmPassword: parsed.data.confirmPassword,
  });

  if (!result.ok) {
    const status =
      result.code === "WEAK_PASSWORD"
        ? 400
        : result.code === "INVALID_TOKEN"
          ? 400
          : 400;
    return NextResponse.json(
      { ok: false, error: result.error ?? "Não foi possível ativar seu acesso." },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    firstAccessCompleted: result.firstAccessCompleted,
    // O login automático fica a cargo do frontend (signIn next-auth).
    email: undefined,
  });
}
