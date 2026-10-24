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

/**
 * Códigos de erro do TikTok que são TRANSITÓRIOS mesmo vindo com HTTP 200.
 *
 * A API v2 devolve sempre HTTP 200 e sinaliza o resultado no corpo — então o
 * status HTTP sozinho não identifica um rate limit. Sem esta lista, um
 * `rate_limit_exceeded` era tratado como erro permanente e não era re-tentado.
 */
const TRANSIENT_TIKTOK_CODES = new Set<string>([
  "rate_limit_exceeded",
  "internal_error",
  "server_error",
]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrai o erro REAL de uma resposta do TikTok. Devolve `null` quando a
 * resposta é de SUCESSO.
 *
 * ===================== POR QUE ISTO EXISTE ============================
 * A API v2 do TikTok responde SEMPRE HTTP 200 e sinaliza o resultado no campo
 * `body.error`:
 *
 *     { "data": { ... }, "error": { "code": "ok", "message": "", "log_id": "..." } }   ← SUCESSO
 *     { "error": { "code": "invalid_token", "message": "..." } }                        ← ERRO
 *
 * O cliente antigo tratava a mera PRESENÇA do campo `error` como falha
 * (`if (!res.ok || data.error)`), sem olhar o `code`. Como toda resposta de
 * sucesso TAMBÉM traz `error` (com `code: "ok"`), o efeito era duplo e grave:
 *   1. TODA chamada bem-sucedida (perfil, lista de vídeos) era lançada como erro;
 *   2. um erro real devolvido com HTTP 200 (`invalid_token`, `scope_not_authorized`)
 *      passava como SUCESSO, e o sync seguia com dados vazios.
 *
 * O endpoint de token (`/oauth/token/`) NÃO usa esse envelope: em erro devolve
 * `error` como STRING (ex.: `"invalid_grant"`) com `error_description`. Os dois
 * formatos são reconhecidos aqui.
 * =====================================================================
 */
function readTikTokError(data: unknown): { code: string; message: string } | null {
  if (!data || typeof data !== "object") return null;
  const error = (data as Record<string, unknown>).error;

  // Sem campo `error` (ex.: sucesso do endpoint de token) → ok.
  if (error == null) return null;

  // Endpoint de token em erro: `error` é string.
  if (typeof error === "string") {
    const desc = (data as Record<string, unknown>).error_description;
    return {
      code: error,
      message: typeof desc === "string" && desc ? desc : error,
    };
  }

  if (typeof error !== "object") return null;

  const rec = error as Record<string, unknown>;
  const code = typeof rec.code === "string" ? rec.code : "";
  // Envelope v2: `code === "ok"` significa SUCESSO — não é erro.
  if (!code || code.toLowerCase() === "ok") return null;

  return {
    code,
    message:
      typeof rec.message === "string" && rec.message
        ? rec.message
        : "A API do TikTok retornou um erro.",
  };
}

/**
 * Executa uma requisição à API do TikTok com timeout + retries para
 * 429/5xx/código transitório/erro de rede, e classificação correta do
 * envelope `error.code` da API v2. Núcleo compartilhado por GET e POST.
 */
async function tiktokRequestWithRetry<T>(url: string, init: RequestInit): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));

    try {
      const res = await fetch(url, { ...init, signal: timeoutSignal() });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const apiError = readTikTokError(data);

      if (!res.ok || apiError) {
        const code = apiError?.code ?? String(res.status);
        const message = apiError?.message ?? "A API do TikTok retornou um erro.";
        const retryable =
          isRetryableStatus(res.status) || TRANSIENT_TIKTOK_CODES.has(code);

        if (retryable && attempt < MAX_RETRIES) {
          lastError = new TikTokApiError(message, code, true);
          continue;
        }
        throw new TikTokApiError(message, code, retryable);
      }

      return data as T;
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

/** Monta a URL da API v2 com a query string opcional. */
function buildApiUrl(path: string, params?: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `${TIKTOK_API_BASE}${path}${query.toString() ? `?${query.toString()}` : ""}`;
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
  return tiktokRequestWithRetry<T>(buildApiUrl(path, params), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * POST autenticado com corpo JSON na API do TikTok.
 *
 * Usado pelos endpoints de LEITURA que exigem POST (ex.: `/video/list/`, que
 * recusa GET) e pelos endpoints que recebem `application/json`. NÃO é usado na
 * troca de token (ver `tiktokApiPost`).
 */
export async function tiktokApiPostJson<T>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
  params?: Record<string, string>
): Promise<T> {
  return tiktokRequestWithRetry<T>(buildApiUrl(path, params), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * POST `application/x-www-form-urlencoded` sem autenticação (troca/refresh de
 * token no endpoint `/oauth/token/`). O corpo vai no body — o client_secret
 * nunca entra na URL nem em log.
 *
 * Lança `TikTokApiError` quando o endpoint recusa (envelope de erro em string
 * ou status HTTP não-2xx); devolve o corpo em caso de sucesso.
 */
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

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const apiError = readTikTokError(data);
  if (!res.ok || apiError) {
    const code = apiError?.code ?? String(res.status);
    const message =
      apiError?.message ?? "O TikTok não pôde concluir a operação solicitada.";
    throw new TikTokApiError(message, code, isRetryableStatus(res.status));
  }

  return data as T & { error?: Record<string, unknown> };
}
