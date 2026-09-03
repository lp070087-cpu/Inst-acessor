import { NextResponse } from "next/server";

import { requestFirstAccessSchema } from "@/lib/validators/first-access";
import {
  requestFirstAccessToken,
  EMAIL_NOT_ELIGIBLE_MESSAGE,
} from "@/lib/first-access";
import { sendFirstAccessEmail } from "@/lib/email";
import { createRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { FIRST_ACCESS_TOKEN_TTL_MINUTES } from "@/lib/first-access/core";
import { getAppBaseUrl } from "@/lib/config/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const firstAccessRateLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST /api/first-access/request
 * ETAPA 1 — solicita o link/código de primeiro acesso pelo e-mail da compra.
 *
 * Segurança:
 *   - Rate limit por IP (proteção anti-brute-force/enumeração).
 *   - Resposta SEMPRE genérica (não revela se o e-mail tem acesso).
 *   - Token de uso único criado apenas se houver acesso elegível.
 *   - O token cru é devolvido UMA vez (nunca armazenado). Em PRODUÇÃO o
 *     e-mail é enviado via provider; em DESENVOLVIMENTO o token pode ser
 *     exibido ao usuário. NUNCA é logado.
 */
export async function POST(request: Request) {
  if (!firstAccessRateLimiter.check(clientIp(request))) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, message: EMAIL_NOT_ELIGIBLE_MESSAGE });
  }

  const parsed = requestFirstAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: EMAIL_NOT_ELIGIBLE_MESSAGE });
  }

  const result = await requestFirstAccessToken(parsed.data.email);

  if (result.ok && result.tokenCreated && result.rawToken && result.email) {
    const isDev = process.env.NODE_ENV !== "production";

    // Monta a URL de ativação (o token vai na query — por HTTPS em produção).
    const baseUrl = getAppBaseUrl();
    const activationUrl = `${baseUrl}/primeiro-acesso?token=${encodeURIComponent(
      result.rawToken
    )}`;

    // Tenta o provider real de e-mail. Se não houver, NÃO finge envio.
    const emailResult = await sendFirstAccessEmail({
      to: result.email,
      activationUrl,
      planName: null,
      expiresInMinutes: FIRST_ACCESS_TOKEN_TTL_MINUTES,
    });

    // Em dev, devolve o link para o usuário conseguir testar o fluxo.
    // Em produção, devolve apenas a mensagem genérica (o link vai por e-mail).
    return NextResponse.json({
      ok: true,
      message: EMAIL_NOT_ELIGIBLE_MESSAGE,
      dev: isDev
        ? {
            activationUrl,
            emailStatus: emailResult.status,
          }
        : undefined,
    });
  }

  // Sem acesso elegível — resposta genérica.
  return NextResponse.json({ ok: true, message: EMAIL_NOT_ELIGIBLE_MESSAGE });
}
