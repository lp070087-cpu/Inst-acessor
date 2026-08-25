import { encryptToken } from "@/lib/crypto";
import { graphGetNoRetry, getMetaCredentials, getRedirectUri } from "./client";
import { IntegrationConfigError } from "./errors";
import type { InstagramTokenPayload } from "./types";

/**
 * Fluxo OAuth da Meta/Instagram.
 * - buildAuthUrl: URL oficial de autorização.
 * - exchangeCodeForToken: troca code por token NO SERVIDOR.
 * - encryptAccessToken: criptografa token antes de persistir.
 */

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v21.0";
const DIALOG_BASE = "https://www.facebook.com";
const GRAPH_BASE = "https://graph.facebook.com";
const DEFAULT_SCOPES = "instagram_business_basic,business_management";

/** Monta a URL oficial de autorização da Meta. */
export function buildAuthUrl(state: string): string {
  const { appId } = getMetaCredentials();
  const redirectUri = getRedirectUri();
  const scopes = process.env.INSTAGRAM_SCOPES || DEFAULT_SCOPES;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: "code",
  });

  return `${DIALOG_BASE}/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Troca o `code` de autorização por um access token (no servidor). */
export async function exchangeCodeForToken(code: string): Promise<InstagramTokenPayload> {
  const { appId, appSecret } = getMetaCredentials();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const url = `${GRAPH_BASE}/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`;

  let data: Record<string, unknown>;
  try {
    const res = await graphGetNoRetry<Record<string, unknown>>(url);
    data = res;
    if (data.error || typeof data.access_token !== "string") {
      const err = (data.error ?? {}) as Record<string, unknown>;
      throw new Error(String(err.message ?? "Erro ao obter token de acesso."));
    }
  } catch (error) {
    if (error instanceof IntegrationConfigError) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Erro ao trocar o código pelo token."
    );
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : null;
  return {
    accessToken: data.access_token as string,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: typeof data.scopes === "string" ? data.scopes : DEFAULT_SCOPES,
  };
}

/** Envolve um token em uma credencial encriptada (para persistir). */
export function encryptAccessToken(token: string): string {
  return encryptToken(token);
}
