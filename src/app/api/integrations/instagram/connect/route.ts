import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { randomState } from "@/lib/crypto";
import { buildAuthUrl, IntegrationConfigError } from "@/lib/integrations/instagram";

export const dynamic = "force-dynamic";

const APP_BASE = process.env.AUTH_URL || "http://localhost:3000";

/**
 * Inicia a conexão com o Instagram (fluxo oficial da Meta).
 *
 * - Exige usuário autenticado.
 * - Gera um `state` criptograficamente seguro e o associa ao usuário.
 * - Monta a URL oficial de autorização e redireciona.
 *
 * REGRA ANTI-TRAVAMENTO (bug crítico):
 * - A URL de autorização é montada ANTES de persistir o status `CONNECTING`.
 *   Se a integração não estiver configurada (`IntegrationConfigError`), nada
 *   é gravado no banco — o status permanece `DISCONNECTED`.
 * - Em QUALQUER erro, a conexão é resetada para `DISCONNECTED` para que o
 *   botão "Conectar Instagram" nunca fique preso em "Conectando...".
 *
 * A interface do SaaS mostra apenas "Conectar Instagram"; a autenticação
 * da Meta (infraestrutura) acontece internamente, no servidor.
 */
export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    // requireSession redireciona para /login via redirect().
    // Em API routes, não lança exceção — retorna o fluxo normal.
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

  try {
    // 1) Monta a URL ANTES de gravar qualquer estado. Se a configuração
    //    estiver ausente, buildAuthUrl lança IntegrationConfigError e o
    //    catch abaixo reseta o status — nunca deixando CONNECTING preso.
    const authUrl = buildAuthUrl(state);

    // 2) Expira states antigos antes de criar o novo.
    await prisma.oAuthState.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    await prisma.oAuthState.create({
      data: {
        userId,
        provider: "instagram",
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // 3) Marca a conexão como "conectando" APENAS após validação de config.
    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "instagram" } },
      create: {
        userId,
        platform: "instagram",
        status: "CONNECTING",
      },
      update: { status: "CONNECTING" },
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    // Reset de segurança: NUNCA deixar o status preso em CONNECTING.
    try {
      await prisma.socialConnection.updateMany({
        where: { userId, platform: "instagram" },
        data: { status: "DISCONNECTED" },
      });
    } catch {
      /* reset é best-effort — não bloqueia o redirect */
    }

    if (error instanceof IntegrationConfigError) {
      // Erro de configuração do servidor — nunca expor secrets.
      console.error("connect error: configuração do Instagram ausente.", error.message);
      return NextResponse.redirect(new URL("/redes-sociais?error=config", APP_BASE));
    }
    console.error("connect error", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.redirect(new URL("/redes-sociais?error=unknown", APP_BASE));
  }
}
