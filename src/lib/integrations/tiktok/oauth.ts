import { createHash, randomBytes } from "crypto";
import { encryptToken } from "@/lib/crypto";
import { getTikTokCredentials, getTikTokRedirectUri, tiktokApiPost } from "./client";
import { IntegrationConfigError } from "./errors";
import type { TikTokTokenPayload } from "./types";

/**
 * Fluxo OAuth do TikTok.
 * - buildAuthUrl: URL oficial de autorização (com PKCE).
 * - exchangeCodeForToken: troca code por token NO SERVIDOR (client_secret).
 * - encryptAccessToken: criptografa token antes de persistir.
 */

const TIKTOK_OAUTH_BASE = "https://www.tiktok.com/v2/auth/authorize";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const DEFAULT_SCOPES = "user.info.basic,video.list";

/** Gera um code_verifier e seu code_challenge (PKCE S256). */
export function createPkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/** Monta a URL oficial de autorização do TikTok. */
export function buildAuthUrl(
  state: string,
  codeChallenge: string,
  scopes = DEFAULT_SCOPES
): string {
  const { clientKey } = getTikTokCredentials();
  const redirectUri = getTikTokRedirectUri();

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${TIKTOK_OAUTH_BASE}?${params.toString()}`;
}

/**
 * Troca o `code` por access token + refresh token.
 * Usa client_secret NO SERVIDOR.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<TikTokTokenPayload> {
  const { clientKey, clientSecret } = getTikTokCredentials();
  const redirectUri = getTikTokRedirectUri();

  try {
    const data = await tiktokApiPost<{
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      refresh_expires_in?: number;
      open_id?: string;
      union_id?: string;
      scope?: string;
    }>(TIKTOK_TOKEN_URL, {
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    if (data.error || typeof data.access_token !== "string" || typeof data.open_id !== "string") {
      const err = (data.error ?? {}) as Record<string, unknown>;
      throw new Error(String(err.message ?? "Erro ao obter token do TikTok."));
    }

    return {
      accessToken: data.access_token,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : null,
      refreshToken: data.refresh_token ?? null,
      openId: data.open_id,
      unionId: data.union_id ?? null,
      scopes: data.scope ?? DEFAULT_SCOPES,
    };
  } catch (error) {
    if (error instanceof IntegrationConfigError) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Erro ao trocar o código pelo token."
    );
  }
}

/** Envolve um token em uma credencial encriptada (para persistir). */
export function encryptAccessToken(token: string): string {
  return encryptToken(token);
}

/**
 * Renova o access token usando o refresh token.
 * O refresh token também é renovado quando o TikTok retorna um novo.
 */
export async function refreshTikTokToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number | null }> {
  const { clientKey, clientSecret } = getTikTokCredentials();

  try {
    const data = await tiktokApiPost<{
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      refresh_expires_in?: number;
    }>(TIKTOK_TOKEN_URL, {
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    if (data.error || typeof data.access_token !== "string") {
      const err = (data.error ?? {}) as Record<string, unknown>;
      throw new Error(String(err.message ?? "Erro ao renovar token do TikTok."));
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : null,
    };
  } catch (error) {
    if (error instanceof IntegrationConfigError) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Erro ao renovar o token."
    );
  }
}
