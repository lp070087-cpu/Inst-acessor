import { IntegrationConfigError } from "./errors";

/**
 * Cliente HTTP da API do TikTok.
 * - OAuth 2.0 (Authorization Code + PKCE).
 * - Timeout via AbortSignal, retries para 429/5xx/network.
 * - Client Secret APENAS no servidor — nunca no frontend.
 */

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const TIKTOK_OAUTH_BASE = "https://www.tiktok.com/v2/auth/authorize";
const FETCH_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export class TikTokApiError extends Error {
  code?: string | number;
  retryable?: boolean;
  constructor(message: string, code?: string | number, retryable = false) {
    super(message);
    this.name = "TikTokApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function getTikTokCredentials(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new IntegrationConfigError(
      "TikTok não configurado no servidor (TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET)."
    );
  }
  return { clientKey, clientSecret };
}

export function getTikTokRedirectUri(): string {
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!redirectUri) {
    throw new IntegrationConfigError("TIKTOK_REDIRECT_URI não configurada no servidor.");
  }
  return redirectUri;
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET autenticado na API do TikTok.
 * Cabeçalho Authorization: Bearer <token> — token só no servidor.
 */
export async function tiktokApiGet<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const query = new URLSearchParams(params);
  const url = `${TIKTOK_API_BASE}${path}${query.toString() ? `?${query.toString()}` : ""}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: timeoutSignal(),
      });

      const data = (await res.json()) as T & {
        error?: { code?: string | number; message?: string };
      };

      if (!res.ok || data.error) {
        const code = String(data.error?.code ?? data.error?.message ?? res.status);
        const message = String(data.error?.message ?? "A API do TikTok retornou um erro.");
        const retryable = isRetryableStatus(res.status);

        if (retryable && attempt < MAX_RETRIES) {
          lastError = new TikTokApiError(message, code, true);
          continue;
        }
        throw new TikTokApiError(message, code, retryable);
      }

      return data;
    } catch (error) {
      if (error instanceof TikTokApiError) throw error;

      const transient = isAbort(error) || error instanceof TypeError;
      if (transient && attempt < MAX_RETRIES) {
        lastError = new TikTokApiError(
          isAbort(error) ? "A API do TikTok demorou para responder." : "Falha de rede ao consultar a API do TikTok.",
          isAbort(error) ? "TIMEOUT" : "NETWORK",
          true
        );
        continue;
      }

      throw new TikTokApiError(
        isAbort(error) ? "A API do TikTok demorou para responder." : "Falha de rede ao consultar a API do TikTok.",
        isAbort(error) ? "TIMEOUT" : "NETWORK"
      );
    }
  }

  throw lastError instanceof TikTokApiError
    ? lastError
    : new TikTokApiError("Falha ao consultar a API do TikTok.", "UNKNOWN");
}

/** POST na API do TikTok (sem retries — para troca de token). */
export async function tiktokApiPost<T>(
  url: string,
  body: Record<string, unknown>
): Promise<T & { error?: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(
      Object.entries(body).reduce<Record<string, string>>((acc, [k, v]) => {
        acc[k] = String(v);
        return acc;
      }, {})
    ),
    signal: timeoutSignal(),
  });
  return (await res.json()) as T & { error?: Record<string, unknown> };
}
