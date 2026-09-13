import { encryptToken } from "@/lib/crypto";
import {
  getRedirectUri,
  getMetaCredentials,
  graphGetNoRetry,
  postFormNoRetry,
  INSTAGRAM_AUTHORIZE_BASE,
  INSTAGRAM_OAUTH_BASE,
  INSTAGRAM_GRAPH_BASE,
} from "./client";
import { InstagramApiError, IntegrationConfigError } from "./errors";
import type { InstagramTokenPayload } from "./types";

/**
 * FLUXO OAUTH OFICIAL â€” INSTAGRAM BUSINESS LOGIN
 * ==============================================
 * O app Meta "Inst Acessor" usa o caso de uso "Gerenciar mensagens e conteÃºdo
 * no Instagram", cujo fluxo Ã© o Instagram Business Login. Este arquivo NÃƒO usa
 * o dialog do Facebook nem `graph.facebook.com`.
 *
 * Etapas oficiais:
 *
 *   1) AUTORIZAÃ‡ÃƒO (navegador)
 *      GET https://www.instagram.com/oauth/authorize
 *          ?client_id=<INSTAGRAM_APP_ID>
 *          &redirect_uri=<INSTAGRAM_REDIRECT_URI>
 *          &response_type=code
 *          &scope=<scopes>
 *          &state=<state CSRF>
 *
 *   2) TROCA DO `code` (servidor) â†’ token de CURTA duraÃ§Ã£o (~1 hora)
 *      POST https://api.instagram.com/oauth/access_token
 *           (application/x-www-form-urlencoded)
 *           client_id, client_secret, grant_type=authorization_code,
 *           redirect_uri, code
 *
 *   3) TOKEN DE LONGA DURAÃ‡ÃƒO (~60 dias) â€” passo OBRIGATÃ“RIO: o token da
 *      etapa 2 expira em ~1 hora e nÃ£o serve para operar o app.
 *      GET https://graph.instagram.com/access_token
 *          ?grant_type=ig_exchange_token
 *          &client_secret=<app secret>
 *          &access_token=<token curto>
 *
 *   4) RENOVAÃ‡ÃƒO (ver `refreshLongLivedToken`) â€” o token longo pode ser
 *      renovado por mais ~60 dias, desde que tenha ao menos 24 horas de vida
 *      e ainda nÃ£o tenha expirado.
 *      GET https://graph.instagram.com/refresh_access_token
 *          ?grant_type=ig_refresh_token
 *          &access_token=<token longo>
 *
 * SeguranÃ§a:
 *   - state/CSRF preservado no passo 1 (validado no callback).
 *   - client_secret vai no BODY (nunca na query/URL).
 *   - Fail-closed: sem configuraÃ§Ã£o, lanÃ§a `IntegrationConfigError`.
 */

/** Scopes oficiais do Instagram Business Login usados pelo Inst Acessor. */
export const INSTAGRAM_DEFAULT_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
  "instagram_business_content_publish",
] as const;

const DEFAULT_SCOPES = INSTAGRAM_DEFAULT_SCOPES.join(",");

/**
 * Scopes efetivos.
 * `INSTAGRAM_SCOPES` continua sendo o OVERRIDE por variÃ¡vel de ambiente
 * (lista separada por vÃ­rgula). Quando ausente, usa os 5 scopes oficiais.
 */
export function getInstagramScopes(): string {
  const override = process.env.INSTAGRAM_SCOPES?.trim();
  return override && override.length > 0 ? override : DEFAULT_SCOPES;
}

/** URL oficial de autorizaÃ§Ã£o do Instagram Business Login. */
export function buildAuthUrl(state: string): string {
  const { appId } = getMetaCredentials();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: getInstagramScopes(),
    state,
  });

  return `${INSTAGRAM_AUTHORIZE_BASE}/oauth/authorize?${params.toString()}`;
}

/** Resposta oficial da troca do code. */
interface CodeExchangeResponse {
  access_token?: string;
  user_id?: string | number;
  /** VersÃµes recentes devolvem `permissions`; versÃµes antigas, `scope`. */
  permissions?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  error_message?: string;
  error_type?: string;
}

/**
 * Passo 2+3: troca o `code` por um token de LONGA duraÃ§Ã£o.
 *
 * Faz a troca do code (`api.instagram.com`) e, em seguida, o exchange
 * obrigatÃ³rio para long-lived (`graph.instagram.com`). O token devolvido Ã© o
 * de ~60 dias â€” Ã© ele que Ã© persistido criptografado.
 *
 * Se o exchange falhar, o token curto NÃƒO Ã© devolvido: um token de 1 hora
 * gravado no banco produziria uma conexÃ£o que "conecta" e quebra minutos
 * depois. Fail-closed.
 */
export async function exchangeCodeForToken(code: string): Promise<InstagramTokenPayload> {
  const { appId, appSecret } = getMetaCredentials();
  const redirectUri = getRedirectUri();

  // ---- Passo 2: code â†’ token curto ----
  let short: CodeExchangeResponse;
  try {
    short = await postFormNoRetry<CodeExchangeResponse>(
      `${INSTAGRAM_OAUTH_BASE}/oauth/access_token`,
      {
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }
    );
  } catch (error) {
    if (error instanceof IntegrationConfigError) throw error;
    throw new InstagramApiError(
      "Erro de rede ao trocar o cÃ³digo pelo token do Instagram.",
      "NETWORK"
    );
  }

  const shortToken = typeof short.access_token === "string" ? short.access_token : "";
  if (!shortToken) {
    const detail =
      typeof short.error_message === "string" && short.error_message.length < 200
        ? short.error_message
        : "Erro ao obter token de acesso do Instagram.";
    throw new InstagramApiError(detail, "TOKEN_EXCHANGE");
  }

  // Scopes efetivamente concedidos (permissions Ã© o nome atual).
  const granted =
    (typeof short.permissions === "string" && short.permissions) ||
    (typeof short.scope === "string" && short.scope) ||
    getInstagramScopes();

  // ---- Passo 3: token curto â†’ token longo (~60 dias) ----
  const long = await exchangeForLongLivedToken(shortToken, appSecret);

  return {
    accessToken: long.accessToken,
    expiresAt: long.expiresAt,
    scopes: granted,
  };
}

/** Resposta oficial do exchange/refresh de token longo. */
interface LongLivedResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: Record<string, unknown>;
}

export interface LongLivedTokenResult {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Passo 3: troca um token curto por um de longa duraÃ§Ã£o (~60 dias).
 * @throws Error quando a API recusa ou nÃ£o devolve token.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appSecret?: string
): Promise<LongLivedTokenResult> {
  const secret = appSecret ?? getMetaCredentials().appSecret;

  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: secret,
    access_token: shortLivedToken,
  });

  const data = await graphGetNoRetry<LongLivedResponse>(
    `${INSTAGRAM_GRAPH_BASE}/access_token?${params.toString()}`
  );

  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!token) {
    console.error("[instagram-oauth] long-lived exchange recusado", data.error ?? {});
    throw new InstagramApiError(
      "O Instagram nÃ£o devolveu o token de longa duraÃ§Ã£o.",
      "LONG_LIVED_EXCHANGE"
    );
  }

  return {
    accessToken: token,
    expiresAt: computeExpiry(data.expires_in),
  };
}

/**
 * Passo 4: renova um token de longa duraÃ§Ã£o por mais ~60 dias.
 *
 * Regras oficiais desta chamada:
 *   - sÃ³ funciona para token com MAIS DE 24 HORAS de vida;
 *   - nÃ£o funciona para token jÃ¡ expirado;
 *   - devolve um token NOVO (nÃ£o estende o prazo do mesmo token).
 *
 * @throws Error quando a API recusa (ex.: token recÃ©m-emitido ou expirado).
 */
export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<LongLivedTokenResult> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: longLivedToken,
  });

  const data = await graphGetNoRetry<LongLivedResponse>(
    `${INSTAGRAM_GRAPH_BASE}/refresh_access_token?${params.toString()}`
  );

  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!token) {
    throw new InstagramApiError(
      "O Instagram nÃ£o renovou o token de acesso.",
      "REFRESH_FAILED"
    );
  }

  return {
    accessToken: token,
    expiresAt: computeExpiry(data.expires_in),
  };
}

/** Converte `expires_in` (segundos) em data absoluta. */
function computeExpiry(expiresIn: unknown): Date {
  const seconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 60 * 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000);
}

/** Envolve um token em uma credencial encriptada (para persistir). */
export function encryptAccessToken(token: string): string {
  return encryptToken(token);
}

export { DEFAULT_SCOPES as INSTAGRAM_DEFAULT_SCOPES_STRING };
