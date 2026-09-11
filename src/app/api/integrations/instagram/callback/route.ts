import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  exchangeCodeForToken,
  getInstagramAccountInfo,
  encryptAccessToken,
  InstagramApiError,
  IntegrationConfigError,
  type InstagramAccountInfo,
  type InstagramTokenPayload,
} from "@/lib/integrations/instagram";
import { getAppBaseUrl } from "@/lib/config/site";

export const dynamic = "force-dynamic";

const REDIRECT_OK = "/redes-sociais?connected=true";
const REDIRECT_ERROR = "/redes-sociais?error=";
const APP_BASE = getAppBaseUrl();

/**
 * Callback oficial do OAuth do Instagram Business Login.
 *
 * Responsabilidades:
 * - validar `state` (CSRF) — associação ao usuário + não consumido + não expirado;
 * - capturar o `code` (ou tratar negação de permissão);
 * - trocar `code` por token NO SERVIDOR (code → token curto → token longo ~60d);
 * - obter dados básicos da conta autorizada (nó `me`, sem Página do Facebook);
 * - persistir token ENCRIPTADO + expiração + scopes + status;
 * - redirecionar para /redes-sociais?connected=true.
 *
 * O `state` é gerado em /api/integrations/instagram/connect e é single-use:
 * este handler o marca como consumido antes da troca de token.
 *
 * REGRA ANTI-TRAVAMENTO (bug crítico):
 * - Todo caminho de erro SAI do status `CONNECTING`. Falhas precoces
 *   (negado, sem code, state inválido/expirado) restauram `CONNECTED` se já
 *   existia token (ex.: "Trocar conta" negado) ou voltam para `DISCONNECTED`.
 * - Assim o botão "Conectar Instagram" nunca fica preso em "Conectando...".
 *
 * Erros redirecionam com código controlado — NUNCA token ou secret.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  // ---- Usuário negou permissão / erro da Meta na autorização ----
  if (error) {
    console.warn(
      `[instagram-callback] autorização negada pela Meta: reason=${errorReason} desc=${errorDescription}`
    );
    if (state) {
      const userId = await resolveStateUser(state);
      if (userId) await resetOrRestore(userId);
    }
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}denied`);
  }

  // ---- Sem code ou sem state ----
  if (!code) {
    if (state) {
      const userId = await resolveStateUser(state);
      if (userId) await resetOrRestore(userId);
    }
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}missing_code`);
  }
  if (!state) {
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}invalid_state`);
  }

  // ---- Validação do state (CSRF) ----
  let oauthState;
  try {
    oauthState = await prisma.oAuthState.findUnique({ where: { state } });
  } catch (err) {
    console.error("[instagram-callback] falha ao consultar state", err);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  if (!oauthState) {
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}invalid_state`);
  }
  if (oauthState.consumed) {
    const userId = oauthState.userId;
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}invalid_state`);
  }
  if (oauthState.expiresAt.getTime() < Date.now()) {
    const userId = oauthState.userId;
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}state_expired`);
  }

  const userId = oauthState.userId;

  // Marca o state como consumido imediatamente (single-use).
  try {
    await prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { consumed: true },
    });
  } catch (err) {
    console.error("[instagram-callback] falha ao consumir state", err);
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- Troca do code por token (no servidor) ----
  let tokenData: InstagramTokenPayload;
  try {
    tokenData = await exchangeCodeForToken(code);
  } catch (err) {
    if (err instanceof IntegrationConfigError) {
      console.error("[instagram-callback] configuração ausente", err.message);
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}config`);
    }
    if (err instanceof InstagramApiError) {
      console.error(
        "[instagram-callback] falha na troca do code por token",
        err.code ?? "meta_error"
      );
      await markError(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}token_exchange`);
    }
    console.error("[instagram-callback] erro inesperado na troca de token", err);
    await markError(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- Obtém dados da conta autorizada ----
  let account: InstagramAccountInfo;
  try {
    account = await getInstagramAccountInfo(tokenData.accessToken);
  } catch (err) {
    if (err instanceof IntegrationConfigError) {
      console.error("[instagram-callback] configuração ausente", err.message);
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}config`);
    }
    if (err instanceof InstagramApiError) {
      console.error(
        "[instagram-callback] falha ao obter dados da conta",
        err.code ?? "meta_error"
      );
      await markError(userId);
      if (err.code === "NOT_IG_BUSINESS") {
        return NextResponse.redirect(`${base}${REDIRECT_ERROR}not_compatible`);
      }
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}account_fetch`);
    }
    console.error("[instagram-callback] erro inesperado ao obter conta", err);
    await markError(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- Persiste a conexão com token encriptado ----
  try {
    const encrypted = encryptAccessToken(tokenData.accessToken);
    const expiresAt = tokenData.expiresAt;

    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "instagram" } },
      create: {
        userId,
        platform: "instagram",
        externalAccountId: account.id,
        username: account.username,
        accountType: account.accountType,
        status: "CONNECTED",
        tokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scopes,
        lastSyncAt: new Date(),
      },
      update: {
        externalAccountId: account.id,
        username: account.username,
        accountType: account.accountType,
        status: "CONNECTED",
        tokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scopes,
        lastSyncAt: new Date(),
      },
    });

    console.info(
      `[instagram-callback] conexão criada/atualizada para user=${userId} (${account.username})`
    );
  } catch (err) {
    console.error("[instagram-callback] falha ao persistir conexão", err);
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  return NextResponse.redirect(`${base}${REDIRECT_OK}`);
}

/** Resolve o userId a partir do state (para reset em falhas precoces). */
async function resolveStateUser(state: string): Promise<string | null> {
  try {
    const record = await prisma.oAuthState.findUnique({
      where: { state },
      select: { userId: true },
    });
    return record?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Sai do status CONNECTING em falhas precoces (sem token novo).
 * - Se já existia conexão com token (ex.: "Trocar conta"), restaura CONNECTED.
 * - Caso contrário, volta para DISCONNECTED (botão habilitado novamente).
 */
async function resetOrRestore(userId: string) {
  try {
    const existing = await prisma.socialConnection.findFirst({
      where: { userId, platform: "instagram" },
      select: { tokenEncrypted: true },
    });
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: { status: existing?.tokenEncrypted ? "CONNECTED" : "DISCONNECTED" },
    });
  } catch {
    /* reset é best-effort — não bloqueia o redirecionamento */
  }
}

/** Marca a conexão como erro (preservando histórico). */
async function markError(userId: string) {
  try {
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: { status: "ERROR" },
    });
  } catch {
    /* falha ao marcar erro não bloqueia o redirecionamento */
  }
}
