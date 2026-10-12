import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  refreshTikTokToken,
  IntegrationConfigError,
  TikTokApiError,
} from "@/lib/integrations/tiktok";

export const dynamic = "force-dynamic";

/**
 * Renova o access token do TikTok.
 *
 * O refresh token é armazenado no formato:
 *   `accessToken|||refreshToken` (encriptado juntos no `tokenEncrypted`).
 *
 * - Exige sessão.
 * - Descriptografa no servidor, renova, re-encripta e persiste.
 * - NUNCA retorna token ao cliente.
 */
export async function POST() {
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
    where: { userId, platform: "tiktok" },
  });

  if (!connection?.tokenEncrypted) {
    return NextResponse.json(
      { error: "Nenhuma conexão com o TikTok." },
      { status: 400 }
    );
  }

  if (connection.status !== "CONNECTED") {
    return NextResponse.json(
      { error: "A conexão não está ativa. Reconecte o TikTok." },
      { status: 400 }
    );
  }

  // Token armazenado no formato `access|||refresh`.
  let accessToken: string;
  let refreshToken: string;
  try {
    const decrypted = decryptToken(connection.tokenEncrypted);
    const parts = decrypted.split("|||");
    accessToken = parts[0] ?? "";
    refreshToken = parts[1] ?? "";
  } catch (err) {
    console.error("[tiktok-refresh] falha ao descriptografar token", err);
    return NextResponse.json(
      { error: "Não foi possível ler a credencial armazenada." },
      { status: 500 }
    );
  }

  if (!refreshToken) {
    return NextResponse.json(
      { error: "Este app não possui refresh token do TikTok." },
      { status: 400 }
    );
  }

  try {
    const renewed = await refreshTikTokToken(refreshToken);

    const newCombined = `${renewed.accessToken}|||${renewed.refreshToken ?? refreshToken}`;
    const encrypted = encryptToken(newCombined);
    const expiresAt = renewed.expiresIn
      ? new Date(Date.now() + renewed.expiresIn * 1000)
      : null;

    await prisma.socialConnection.updateMany({
      where: { userId, platform: "tiktok" },
      data: { tokenEncrypted: encrypted, tokenExpiresAt: expiresAt },
    });

    console.info(`[tiktok-refresh] acesso renovado para user=${userId}`);
    return NextResponse.json({ ok: true, refreshed: true });
  } catch (err) {
    if (err instanceof IntegrationConfigError) {
      return NextResponse.json(
        { error: "Integração ainda não configurada." },
        { status: 500 }
      );
    }
    // Distingue "refresh token inválido/expirado" (não há o que renovar) de uma
    // falha transitória. Marcar a conexão como ERROR nos dois casos fazia uma
    // queda momentânea parecer exigir reconexão. ERRO = reconectar.
    if (isInvalidRefreshToken(err)) {
      console.error("[tiktok-refresh] refresh token inválido/expirado — reconexão necessária");
      await prisma.socialConnection
        .updateMany({ where: { userId, platform: "tiktok" }, data: { status: "ERROR" } })
        .catch(() => {
          /* best-effort: a marcação de estado não bloqueia a resposta */
        });
      return NextResponse.json(
        { error: "O acesso ao TikTok expirou. Conecte novamente.", reconnect: true },
        { status: 401 }
      );
    }
    console.error("[tiktok-refresh] erro transitório ao renovar; credencial preservada");
    return NextResponse.json(
      { error: "Não foi possível renovar o acesso agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}

/**
 * O TikTok sinaliza refresh token inválido/expirado com um destes códigos no
 * envelope `error.code`. Fora deles, a falha é transitória (rede/5xx).
 */
function isInvalidRefreshToken(err: unknown): boolean {
  if (err instanceof TikTokApiError) {
    const code = String(err.code ?? "").toLowerCase();
    return (
      code === "invalid_grant" ||
      code === "invalid_token" ||
      code === "access_token_invalid" ||
      code === "refresh_token_invalid" ||
      code === "token_expired"
    );
  }
  return false;
}
