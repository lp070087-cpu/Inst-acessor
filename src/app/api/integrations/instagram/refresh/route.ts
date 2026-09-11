import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  getInstagramAccountInfo,
  refreshLongLivedToken,
  InstagramApiError,
  IntegrationConfigError,
} from "@/lib/integrations/instagram";
import { shouldAttemptRenewal } from "@/lib/integrations/instagram/token-policy";

export const dynamic = "force-dynamic";

/**
 * RENOVAÇÃO REAL do acesso ao Instagram + atualização dos dados da conta.
 *
 * O fluxo é o do Instagram Business Login (`graph.instagram.com`).
 * O token persistido é o de LONGA duração (~60 dias).
 *
 * O que esta rota faz, nesta ordem:
 *
 *   1) Renova o token longo (`grant_type=ig_refresh_token`) quando ele estiver
 *      apto — a API só renova token com MAIS DE 24 HORAS de vida e ainda não
 *      expirado. Fora dessa janela a renovação é IGNORADA de propósito (não é
 *      erro: chamar cedo demais é recusado pela própria API).
 *   2) Em seguida, atualiza os dados básicos da conta (username, id, tipo).
 *   3) Persiste o token NOVO criptografado e a nova `tokenExpiresAt`.
 *
 * Se a renovação falhar por motivo que não seja "ainda não elegível", o token
 * atual é PRESERVADO (nunca sobrescrevemos um token válido por nada) e a rota
 * devolve erro controlado. Se a API indicar token inválido/expirado, a rota
 * orienta reconectar (`reconnect: true`).
 *
 * Regra de segurança:
 * - Exige sessão.
 * - Só atua na conexão do próprio usuário (userId da sessão).
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

  // ---- 1) Renovação do token longo (quando elegível) ----
  let currentToken = accessToken;
  let newExpiry: Date | null = connection.tokenExpiresAt ?? null;
  let renewed = false;

  if (shouldAttemptRenewal(connection.tokenExpiresAt, connection.createdAt)) {
    try {
      const result = await refreshLongLivedToken(accessToken);
      currentToken = result.accessToken;
      newExpiry = result.expiresAt;
      renewed = true;
    } catch (err) {
      // Token inválido/expirado → reconectar (não há o que renovar).
      if (isInvalidTokenError(err)) {
        console.error("[instagram-refresh] token inválido/expirado — reconexão necessária");
        await markReconnectNeeded(userId);
        return NextResponse.json(
          { error: "O acesso ao Instagram expirou. Conecte novamente.", reconnect: true },
          { status: 401 }
        );
      }
      // Falha transitória (rede/5xx): preserva o token atual e segue para a
      // leitura dos dados — não derruba o token válido por causa disto.
      console.warn(
        "[instagram-refresh] renovação não aplicada nesta chamada; token atual preservado"
      );
    }
  }

  // ---- 2) Atualiza dados básicos da conta ----
  try {
    const account = await getInstagramAccountInfo(currentToken);

    // ---- 3) Persiste token renovado (se houve) + dados da conta ----
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: {
        externalAccountId: account.id,
        username: account.username,
        accountType: account.accountType,
        lastSyncAt: new Date(),
        // O token só é reescrito quando foi realmente renovado.
        ...(renewed
          ? { tokenEncrypted: encryptToken(currentToken), tokenExpiresAt: newExpiry }
          : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      renewed,
      account: {
        username: account.username,
        accountType: account.accountType,
      },
    });
  } catch (err) {
    if (err instanceof InstagramApiError) {
      // Token inválido/expirado → orienta reconectar (não expõe token).
      const invalid = isInvalidTokenError(err);
      console.error(
        `[instagram-refresh] erro da API (${invalid ? "token inválido/expirado" : "erro Instagram"})`,
        err.code ?? "api_error"
      );
      if (invalid) {
        await markReconnectNeeded(userId);
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

/** Identifica erro de token inválido/expirado nas APIs do Instagram. */
function isInvalidTokenError(err: unknown): boolean {
  if (err instanceof InstagramApiError) {
    const code = String(err.code ?? "");
    return code === "190" || code === "SESSION_EXPIRED" || code === "OAuthException";
  }
  if (err instanceof Error) {
    return /expired|invalid.*token|session/i.test(err.message);
  }
  return false;
}

/**
 * Marca a conexão como precisando de reconexão.
 * Preserva o token atual (histórico e dados permanecem) — apenas sinaliza.
 */
async function markReconnectNeeded(userId: string) {
  try {
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: { status: "ERROR" },
    });
  } catch {
    /* best-effort */
  }
}
