/**
 * HTTP SEGURO PARA PUBLICAÇÃO REAL
 * =================================
 * Cliente fetch com timeout e retries controlados para as APIs oficiais.
 * NUNCA loga tokens/segredos — apenas códigos de erro seguros.
 *
 * Usado pelos adapters reais de Instagram (Graph API) e TikTok
 * (Content Posting API). Mesmo padrão dos clientes existentes
 * (`integrations/instagram/client.ts` e `integrations/tiktok/client.ts`).
 */

const PUBLISH_TIMEOUT_MS = 20000;
const PUBLISH_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

/** Erro tipado da publicação real (sem segredos). */
export class PublishHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly code?: string | number;
  constructor(message: string, status: number, retryable: boolean, code?: string | number) {
    super(message);
    this.name = "PublishHttpError";
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(PUBLISH_TIMEOUT_MS);
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

export interface PublishHttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/**
 * Executa um fetch com timeout + retries para 429/5xx/network.
 * Retorna o corpo JSON (assume-se que as APIs respondem JSON).
 */
export async function publishHttp<T>(
  url: string,
  options: PublishHttpOptions = {}
): Promise<T> {
  const { method = "GET", headers = {}, body, timeoutMs = PUBLISH_TIMEOUT_MS } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= PUBLISH_MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));

    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: timeoutMs === Infinity ? undefined : AbortSignal.timeout(timeoutMs),
      });

      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        // Erro HTTP: classifica retryável (429/5xx) ou permanente (4xx).
        const retryable = isRetryableStatus(res.status);
        const message = safeErrorText(data, res.status);
        if (retryable && attempt < PUBLISH_MAX_RETRIES) {
          lastError = new PublishHttpError(message, res.status, true);
          continue;
        }
        throw new PublishHttpError(message, res.status, retryable);
      }

      return data as T;
    } catch (error) {
      if (error instanceof PublishHttpError) throw error;

      // Timeout/rede → retryável.
      const transient = isAbort(error) || error instanceof TypeError;
      if (transient && attempt < PUBLISH_MAX_RETRIES) {
        lastError = new PublishHttpError(
          "Falha de rede ao contactar a plataforma. Tente novamente.",
          0,
          true,
          isAbort(error) ? "TIMEOUT" : "NETWORK"
        );
        continue;
      }

      throw new PublishHttpError(
        "Falha de rede ao contactar a plataforma. Tente novamente.",
        0,
        false,
        isAbort(error) ? "TIMEOUT" : "NETWORK"
      );
    }
  }

  throw lastError instanceof PublishHttpError
    ? lastError
    : new PublishHttpError("Falha ao contactar a plataforma.", 0, true);
}

/** Extrai uma mensagem de erro segura (nunca inclui token/query). */
function safeErrorText(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const err = rec.error as Record<string, unknown> | undefined;
    const candidate = String(err?.message ?? rec.message ?? "");
    if (candidate && candidate.length < 200) return candidate;
  }
  return status >= 500 ? "A plataforma retornou um erro." : "A plataforma rejeitou a solicitação.";
}

export { PUBLISH_TIMEOUT_MS, PUBLISH_MAX_RETRIES };
