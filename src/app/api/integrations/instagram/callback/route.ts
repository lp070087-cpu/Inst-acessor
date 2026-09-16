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
 * - validar `state` (CSRF) â€” associaÃ§Ã£o ao usuÃ¡rio + nÃ£o consumido + nÃ£o expirado;
 * - capturar o `code` (ou tratar negaÃ§Ã£o de permissÃ£o);
 * - trocar `code` por token NO SERVIDOR (code â†’ token curto â†’ token longo ~60d);
 * - obter dados bÃ¡sicos da conta autorizada (nÃ³ `me`, sem PÃ¡gina do Facebook);
 * - persistir token ENCRIPTADO + expiraÃ§Ã£o + scopes + status;
 * - redirecionar para /redes-sociais?connected=true.
 *
 * O `state` Ã© gerado em /api/integrations/instagram/connect e Ã© single-use:
 * este handler o marca como consumido antes da troca de token.
 *
 * REGRA ANTI-TRAVAMENTO (bug crÃ­tico):
 * - Todo caminho de erro SAI do status `CONNECTING`. Falhas precoces
 *   (negado, sem code, state invÃ¡lido/expirado) restauram `CONNECTED` se jÃ¡
 *   existia token (ex.: "Trocar conta" negado) ou voltam para `DISCONNECTED`.
 * - Assim o botÃ£o "Conectar Instagram" nunca fica preso em "Conectando...".
 *
 * Erros redirecionam com cÃ³digo controlado â€” NUNCA token ou secret.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  // ---- UsuÃ¡rio negou permissÃ£o / erro da Meta na autorizaÃ§Ã£o ----
  //
  // Dois casos distintos, com mensagens diferentes na UI:
  //   - CANCELAMENTO: o usuÃ¡rio fechou/negou a tela de autorizaÃ§Ã£o.
  //   - PERMISSÃƒO: a Meta recusou o acesso (ex.: conta sem permissÃ£o para o app).
  //
  // Nenhum dos dois Ã© conexÃ£o bem-sucedida. O `error_description` da Meta Ã©
  // usado apenas para CLASSIFICAR; nunca Ã© repassado para a URL.
  if (error) {
    const reason = `${errorReason ?? ""} ${errorDescription ?? ""}`.toLowerCase();
    const isDenied =
      error === "access_denied" ||
      reason.includes("user_denied") ||
      reason.includes("cancel") ||
      reason.includes("denied");

    console.warn(
      `[instagram-callback] autorizaÃ§Ã£o nÃ£o concluÃ­da: error=${error} reason=${errorReason}`
    );
    if (state) {
      const userId = await resolveStateUser(state);
      if (userId) await resetOrRestore(userId);
    }
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}${isDenied ? "denied" : "permission"}`);
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

  // ---- ValidaÃ§Ã£o do state (CSRF) ----
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
      console.error("[instagram-callback] configuraÃ§Ã£o ausente", err.message);
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}config`);
    }
    if (err instanceof InstagramApiError) {
      console.error(
        "[instagram-callback] falha na troca do code por token",
        err.code ?? "meta_error"
      );
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}token_exchange`);
    }
    console.error("[instagram-callback] erro inesperado na troca de token", err);
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- ObtÃ©m dados da conta autorizada ----
  let account: InstagramAccountInfo;
  try {
    account = await getInstagramAccountInfo(tokenData.accessToken);
  } catch (err) {
    if (err instanceof IntegrationConfigError) {
      console.error("[instagram-callback] configuraÃ§Ã£o ausente", err.message);
      await resetOrRestore(userId);
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}config`);
    }
    if (err instanceof InstagramApiError) {
      console.error(
        "[instagram-callback] falha ao obter dados da conta",
        err.code ?? "meta_error"
      );
      await resetOrRestore(userId);
      if (err.code === "NOT_IG_BUSINESS") {
        return NextResponse.redirect(`${base}${REDIRECT_ERROR}not_compatible`);
      }
      return NextResponse.redirect(`${base}${REDIRECT_ERROR}account_fetch`);
    }
    console.error("[instagram-callback] erro inesperado ao obter conta", err);
    await resetOrRestore(userId);
    return NextResponse.redirect(`${base}${REDIRECT_ERROR}server`);
  }

  // ---- Persiste a conexÃ£o com token encriptado ----
  try {
    const encrypted = encryptAccessToken(tokenData.accessToken);
    const expiresAt = tokenData.expiresAt;

    const connection = await prisma.socialConnection.upsert({
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
        // NÃO marcamos `lastSyncAt` aqui: conectar não é sincronizar. Antes
        // este campo era preenchido no OAuth, o que (a) mostrava "sincronizado
        // agora" sem nenhum dado e (b) bloqueava o primeiro sync real pelo
        // cooldown de 60s.
      },
      update: {
        externalAccountId: account.id,
        username: account.username,
        accountType: account.accountType,
        status: "CONNECTED",
        tokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scopes,
      },
    });

    // Perfil mínimo já na conexão: garante avatar/nome reais no Dashboard e em
    // /redes-sociais ANTES da primeira sincronização. Campos ausentes ficam null
    // (a UI usa fallback). Os valores completos chegam depois, via /sync.
    try {
      await prisma.instagramProfile.upsert({
        where: { socialConnectionId: connection.id },
        create: {
          userId,
          socialConnectionId: connection.id,
          igAccountId: account.id,
          username: account.username,
          name: account.name ?? null,
          profilePictureUrl: account.profilePictureUrl ?? null,
        },
        update: {
          username: account.username,
          name: account.name ?? null,
          profilePictureUrl: account.profilePictureUrl ?? null,
        },
      });
    } catch (profileErr) {
      // Não invalida a conexão: o perfil é recriado na próxima sincronização.
      console.error("[instagram-callback] falha ao persistir perfil", profileErr);
    }

    console.info(
      `[instagram-callback] conexão criada/atualizada para user=${userId} (${account.username})`
    );
  } catch (err) {
    console.error("[instagram-callback] falha ao persistir conexÃ£o", err);
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
 * - Se jÃ¡ existia conexÃ£o com token (ex.: "Trocar conta"), restaura CONNECTED.
 * - Caso contrÃ¡rio, volta para DISCONNECTED (botÃ£o habilitado novamente).
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
    /* reset Ã© best-effort â€” nÃ£o bloqueia o redirecionamento */
  }
}

/** Marca a conexÃ£o como erro (preservando histÃ³rico). */
async function markError(userId: string) {
  try {
    await prisma.socialConnection.updateMany({
      where: { userId, platform: "instagram" },
      data: { status: "ERROR" },
    });
  } catch {
    /* falha ao marcar erro nÃ£o bloqueia o redirecionamento */
  }
}

