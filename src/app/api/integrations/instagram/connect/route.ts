import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { randomState } from "@/lib/crypto";
import { buildAuthUrl, IntegrationConfigError } from "@/lib/integrations/instagram";

export const dynamic = "force-dynamic";

/**
 * Inicia a conexão com o Instagram (fluxo oficial da Meta).
 *
 * - Exige usuário autenticado.
 * - Gera um `state` criptograficamente seguro e o associa ao usuário.
 * - Monta a URL oficial de autorização e redireciona.
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
      new URL("/login?callbackUrl=/app/redes-sociais", process.env.AUTH_URL || "http://localhost:3000")
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/app/redes-sociais", process.env.AUTH_URL || "http://localhost:3000")
    );
  }

  const state = randomState();

  try {
    // Expira states antigos antes de criar o novo.
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

    // Marca a conexão como "conectando" para feedback na UI.
    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "instagram" } },
      create: {
        userId,
        platform: "instagram",
        status: "CONNECTING",
      },
      update: { status: "CONNECTING" },
    });

    const authUrl = buildAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    if (error instanceof IntegrationConfigError) {
      // Erro de configuração do servidor — nunca expor secrets.
      console.error("connect error: configuração do Instagram ausente.", error.message);
      return NextResponse.redirect(
        new URL("/app/redes-sociais?error=config", process.env.AUTH_URL || "http://localhost:3000")
      );
    }
    console.error("connect error", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.redirect(
      new URL("/app/redes-sociais?error=unknown", process.env.AUTH_URL || "http://localhost:3000")
    );
  }
}
