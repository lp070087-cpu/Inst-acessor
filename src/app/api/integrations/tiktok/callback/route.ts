import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import type { OAuthState } from "@prisma/client";
import {
  exchangeCodeForToken,
  encryptAccessToken,
  IntegrationConfigError,
} from "@/lib/integrations/tiktok";
import { getAppBaseUrl } from "@/lib/config/site";

export const dynamic = "force-dynamic";

const REDIRECT_OK = "/redes-sociais?connected=true";
const REDIRECT_ERROR = "/redes-sociais?error=";
const APP_BASE = getAppBaseUrl();

/**
 * Callback oficial do OAuth do TikTok.
 *
 * - valida `state` (CSRF) + `code_verifier` (PKCE);
 * - troca `code` por token NO SERVIDOR (client_secret);
 * - persiste token ENCRIPTADO + open_id + expiração + scopes;
 * - redireciona para /redes-sociais?connected=true.
 *
 * REGRA ANTI-TRAVAMENTO (bug crítico):
 * - Todo caminho de erro SAI do status `CONNECTING`. Falhas precoces
 *   (negado, sem code, state inválido/expirado) restauram `CONNECTED` se já
 *   existia token (ex.: "Trocar conta" negado) ou voltam para `DISCONNECTED`.
 * - Assim o botão "Conectar TikTok" nunca fica preso em "Conectando...".
 *
 * Erros redirecionam com código controlado — NUNCA token ou secret.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // ---- Usuário negou permissão / erro do TikTok ----
  if (error) {
    console.warn(`[tiktok-callback] autorização negada pelo TikTok: ${error}`);
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
  let oauthState: OAuthState | null;
  try {
    oauthState = await prisma.oAuthState.findUnique({ where: { state } });
  } catch (err) {
    console.error("[tiktok-callback] falha ao consultar state", err);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  if (!oauthState || oauthState.provider !== "tiktok") {
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
  const codeVerifier = oauthState.codeVerifier;

  // Marca o state como consumido imediatamente (single-use).
  try {
    await prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { consumed: true },
    });
  } catch (err) {
    console.error("[tiktok-callback] falha ao consumir state", err);
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- Troca do code por token (no servidor) ----
  if (!codeVerifier) {
    console.error("[tiktok-callback] code_verifier ausente (PKCE)");
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  let tokenData: Awaited<ReturnType<typeof exchangeCodeForToken>>;
  try {
    tokenData = await exchangeCodeForToken(code, codeVerifier);
  } catch (err) {
    if (err instanceof IntegrationConfigError) {
      console.error("[tiktok-callback] configuração ausente", err.message);
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}config`);
    }
    console.error("[tiktok-callback] falha na troca do code por token", err);
    await markError(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}token_exchange`);
  }

  // ---- Persiste a conexão com token encriptado ----
  try {
    // Se houver refresh_token, armazena no formato `access|||refresh`
    // (encriptado junto). O refresh route espera esse formato.
    const combined = tokenData.refreshToken
      ? `${tokenData.accessToken}|||${tokenData.refreshToken}`
      : tokenData.accessToken;
    const encrypted = encryptAccessToken(combined);
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000)
      : null;

    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "tiktok" } },
      create: {
        userId,
        platform: "tiktok",
        externalAccountId: tokenData.openId,
        username: null, // será preenchido no primeiro sync
        accountType: "BUSINESS",
        status: "CONNECTED",
        tokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scopes,
        lastSyncAt: new Date(),
      },
      update: {
        externalAccountId: tokenData.openId,
        username: null,
        accountType: "BUSINESS",
        status: "CONNECTED",
        tokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scopes,
        lastSyncAt: new Date(),
      },
    });

    console.info(
      `[tiktok-callback] conexão criada/atualizada para user=${userId} (open_id=${tokenData.openId})`
    );
  } catch (err) {
    console.error("[tiktok-callback] falha ao persistir conexão", err);
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
      where: { userId, platform: "tiktok" },
      select: { tokenEncrypted: true },
    });
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "tiktok" },
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
      where: { userId, platform: "tiktok" },
      data: { status: "ERROR" },
    });
  } catch {
    /* falha ao marcar erro não bloqueia o redirecionamento */
  }
}
