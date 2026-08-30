import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { randomState } from "@/lib/crypto";
import { buildAuthUrl, createPkce, IntegrationConfigError } from "@/lib/integrations/tiktok";

export const dynamic = "force-dynamic";

const APP_BASE = process.env.AUTH_URL || "http://localhost:3000";

/**
 * Inicia a conexão com o TikTok (OAuth 2.0 + PKCE).
 *
 * - Exige usuário autenticado.
 * - Gera `state` (CSRF) e `code_verifier` (PKCE) — persistidos.
 * - Monta a URL oficial de autorização e redireciona.
 *
 * REGRA ANTI-TRAVAMENTO (bug crítico):
 * - A URL de autorização é montada ANTES de persistir o status `CONNECTING`.
 *   Se a integração não estiver configurada (`IntegrationConfigError`), nada
 *   é gravado no banco — o status permanece `DISCONNECTED`.
 * - Em QUALQUER erro, a conexão é resetada para `DISCONNECTED` para que o
 *   botão "Conectar TikTok" nunca fique preso em "Conectando...".
 *
 * Client Secret do TikTok NUNCA vai ao frontend.
 */
export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/redes-sociais", APP_BASE)
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/redes-sociais", APP_BASE)
    );
  }

  const state = randomState();
  const { codeVerifier, codeChallenge } = createPkce();

  try {
    // 1) Monta a URL ANTES de gravar qualquer estado. Se a configuração
    //    estiver ausente, buildAuthUrl lança IntegrationConfigError e o
    //    catch abaixo reseta o status — nunca deixando CONNECTING preso.
    const authUrl = buildAuthUrl(state, codeChallenge);

    // 2) Expira states antigos do TikTok antes de criar o novo.
    await prisma.oAuthState.deleteMany({
      where: { userId, provider: "tiktok", expiresAt: { lt: new Date() } },
    });

    // 3) Persiste state + code_verifier (PKCE) associados ao usuário.
    await prisma.oAuthState.create({
      data: {
        userId,
        provider: "tiktok",
        state,
        codeVerifier,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // 4) Marca a conexão como "conectando" APENAS após validação de config.
    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "tiktok" } },
      create: { userId, platform: "tiktok", status: "CONNECTING" },
      update: { status: "CONNECTING" },
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    // Reset de segurança: NUNCA deixar o status preso em CONNECTING.
    try {
      await prisma.socialConnection.updateMany({
        where: { userId, platform: "tiktok" },
        data: { status: "DISCONNECTED" },
      });
    } catch {
      /* reset é best-effort — não bloqueia o redirect */
    }

    if (error instanceof IntegrationConfigError) {
      console.error("connect error: configuração do TikTok ausente.", error.message);
      return NextResponse.redirect(new URL("/redes-sociais?error=config", APP_BASE));
    }
    console.error("connect error", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.redirect(new URL("/redes-sociais?error=unknown", APP_BASE));
  }
}
