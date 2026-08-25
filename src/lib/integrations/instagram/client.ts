import { IntegrationConfigError } from "./errors";

/**
 * Cliente HTTP da Graph API da Meta/Instagram.
 * - Timeout via AbortSignal.
 * - Retries controlados para falhas transitórias (429/5xx/network).
 * - Rate limit: respeita cabeçalho X-App-Usage quando presente.
 * - Não expõe credenciais.
 */

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v21.0";
const GRAPH_BASE = "https://graph.facebook.com";
const FETCH_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export class InstagramApiError extends Error {
  code?: string | number;
  retryable?: boolean;
  constructor(message: string, code?: string | number, retryable = false) {
    super(message);
    this.name = "InstagramApiError";
    this.code = code;
    this.retryable = retryable;
  }
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

export function getMetaCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new IntegrationConfigError(
      "Meta/Instagram não configurado no servidor (META_APP_ID/INSTAGRAM_APP_ID e APP_SECRET)."
    );
  }
  return { appId, appSecret };
}

export function getRedirectUri(): string {
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!redirectUri) {
    throw new IntegrationConfigError("INSTAGRAM_REDIRECT_URI não configurada no servidor.");
  }
  return redirectUri;
}

/**
 * GET na Graph API com retries e timeout.
 * @throws InstagramApiError
 */
export async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${GRAPH_BASE}/${GRAPH_VERSION}/${path}${
    path.includes("?") ? "&" : "?"
  }access_token=${encodeURIComponent(accessToken)}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const res = await fetch(url, { method: "GET", signal: timeoutSignal() });

      // Rate limit: loga uso quando a Meta informa.
      const appUsage = res.headers.get("X-App-Usage");
      if (appUsage) {
        // não loga nada sensível — apenas indicação de uso
        console.debug(`[instagram-client] X-App-Usage: ${appUsage}`);
      }

      const data = (await res.json()) as T & { error?: Record<string, unknown> };

      if (!res.ok || data.error) {
        const code = String(data?.error?.code ?? data?.error?.type ?? res.status);
        const message = String(data?.error?.message ?? "A API do Instagram retornou um erro.");
        const retryable = isRetryableStatus(res.status) || (data.error && typeof data.error.code === "number" && data.error.code >= 500);

        if (retryable && attempt < MAX_RETRIES) {
          lastError = new InstagramApiError(message, code, true);
          continue;
        }

        throw new InstagramApiError(message, code, retryable);
      }

      return data;
    } catch (error) {
      if (error instanceof InstagramApiError) throw error;

      // Timeout / rede — tenta novamente se ainda houver tentativas.
      const transient = isAbort(error) || error instanceof TypeError;
      if (transient && attempt < MAX_RETRIES) {
        lastError = new InstagramApiError(
          isAbort(error) ? "A API do Instagram demorou para responder." : "Falha de rede ao consultar a API do Instagram.",
          isAbort(error) ? "TIMEOUT" : "NETWORK",
          true
        );
        continue;
      }

      throw new InstagramApiError(
        isAbort(error) ? "A API do Instagram demorou para responder." : "Falha de rede ao consultar a API do Instagram.",
        isAbort(error) ? "TIMEOUT" : "NETWORK"
      );
    }
  }

  throw lastError instanceof InstagramApiError
    ? lastError
    : new InstagramApiError("Falha ao consultar a API do Instagram.", "UNKNOWN");
}

/** GET na Graph API sem retries (para troca de token — 1 chamada). */
export async function graphGetNoRetry<T>(url: string): Promise<T & { error?: Record<string, unknown> }> {
  const res = await fetch(url, { method: "GET", signal: timeoutSignal() });
  return (await res.json()) as T & { error?: Record<string, unknown> };
}
