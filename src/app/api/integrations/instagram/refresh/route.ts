import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  getInstagramAccountInfo,
  InstagramApiError,
  IntegrationConfigError,
} from "@/lib/integrations/instagram";

export const dynamic = "force-dynamic";

/**
 * Atualiza os dados básicos da conta conectada (username, id, tipo).
 *
 * Regra de segurança:
 * - Exige sessão.
 * - Só atualiza a conexão do próprio usuário (userId da sessão).
 * - O token é DESCRIPTADO no servidor apenas para chamar a API.
 *   NUNCA retorna o token; apenas dados não sensíveis.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
  });

  if (!connection?.tokenEncrypted) {
    return NextResponse.json(
      { error: "Nenhuma conexão com o Instagram." },
      { status: 400 }
    );
  }

  if (connection.status !== "CONNECTED") {
    return NextResponse.json(
      { error: "A conexão não está ativa. Reconecte o Instagram." },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.tokenEncrypted);
  } catch (err) {
    console.error("[instagram-refresh] falha ao descriptografar token", err);
    return NextResponse.json(
      { error: "Não foi possível ler a credencial armazenada." },
      { status: 500 }
    );
  }

  try {
    const account = await getInstagramAccountInfo(accessToken);

    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: {
        externalAccountId: account.id,
        username: account.username,
        accountType: account.accountType,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      account: {
        username: account.username,
        accountType: account.accountType,
      },
    });
  } catch (err) {
    if (err instanceof InstagramApiError) {
      // Token inválido/expirado → orienta reconectar (não expõe token).
      const invalid = err.code === 190 || String(err.code) === "190" || err.code === "SESSION_EXPIRED";
      console.error(
        `[instagram-refresh] erro da API (${invalid ? "token inválido/expirado" : "erro Meta"})`,
        err.code ?? "meta_error"
      );
      if (invalid) {
        return NextResponse.json(
          { error: "O acesso ao Instagram expirou. Conecte novamente.", reconnect: true },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Não foi possível atualizar os dados. Tente novamente." },
        { status: 502 }
      );
    }
    if (err instanceof IntegrationConfigError) {
      return NextResponse.json(
        { error: "Integração ainda não configurada." },
        { status: 500 }
      );
    }
    console.error("[instagram-refresh] erro inesperado", err);
    return NextResponse.json(
      { error: "Não foi possível atualizar os dados. Tente novamente." },
      { status: 500 }
    );
  }
}
