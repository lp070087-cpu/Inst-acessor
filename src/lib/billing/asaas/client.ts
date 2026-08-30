import { getAsaasConfig, type AsaasConfig } from "./config";

/**
 * ASAAS — CLIENTE HTTP (server-only)
 * ===================================
 * Camada fina sobre `fetch` para a API v3 do Asaas.
 *
 * Regras:
 *   - NUNCA importar em client component (segredos do servidor).
 *   - Headers: `access_token`, `Content-Type: application/json`,
 *     `User-Agent` identificando o Inst Acessor.
 *   - Timeout em todas as chamadas.
 *   - Erros tipados (`AsaasHttpError`) com status HTTP + código/mensagem da API.
 *   - Respostas sanitizadas (campos sensíveis removidos) antes de retornar ao
 *     chamador — nunca inclui tokens/secrets.
 *   - NENHUMA credencial é logada.
 *
 * Nenhuma chamada real é feita quando `ASAAS_API_KEY` está ausente:
 * os métodos lançam `AsaasNotConfiguredError` (fail-closed).
 */

export const ASAAS_USER_AGENT = "InstAcessor/1.0 (+SaaS de crescimento)";
export const ASAAS_TIMEOUT_MS = 15_000;

/** Erro lançado quando a API key não está configurada. */
export class AsaasNotConfiguredError extends Error {
  constructor() {
    super("Integração Asaas não configurada no servidor.");
    this.name = "AsaasNotConfiguredError";
  }
}

/** Erro de HTTP tipado com status e corpo (sanitizado) da API. */
export class AsaasHttpError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errors: Array<{ code?: string; description?: string }>;

  constructor(status: number, body: unknown) {
    const parsed = parseErrorBody(body);
    super(parsed.message);
    this.name = "AsaasHttpError";
    this.status = status;
    this.code = parsed.code;
    this.errors = parsed.errors;
  }
}

function parseErrorBody(body: unknown): {
  message: string;
  code: string | null;
  errors: Array<{ code?: string; description?: string }>;
} {
  if (typeof body !== "object" || body === null) {
    return { message: "Erro desconhecido do Asaas.", code: null, errors: [] };
  }
  const obj = body as Record<string, unknown>;
  const errors = Array.isArray(obj.errors)
    ? (obj.errors as Array<{ code?: string; description?: string }>)
    : [];
  const first = errors[0];
  return {
    message: first?.description ?? (typeof obj.message === "string" ? obj.message : "Erro desconhecido do Asaas."),
    code: first?.code ?? (typeof obj.code === "string" ? obj.code : null),
    errors,
  };
}

export interface AsaasRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  config?: AsaasConfig;
  /** Se true, não exige apiKey (ex.: webhook não usa a API). */
  allowNoKey?: boolean;
}

/** Remove chaves sensíveis conhecidas de um objeto (nunca logar tokens). */
export function sanitizeAsaasPayload(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizeAsaasPayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|access_|apikey|api_key|authorization/i.test(k)) continue;
    out[k] = typeof v === "object" && v !== null ? sanitizeAsaasPayload(v) : v;
  }
  return out;
}

async function request<T>(opts: AsaasRequestOptions): Promise<T> {
  const config = opts.config ?? getAsaasConfig();

  if (!opts.allowNoKey && !config.apiKey) {
    throw new AsaasNotConfiguredError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASAAS_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": ASAAS_USER_AGENT,
  };
  if (config.apiKey) headers["access_token"] = config.apiKey;

  try {
    const res = await fetch(`${config.baseUrl}${opts.path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      // NUNCA loga o corpo completo — apenas código/mensagem sanitizados.
      const err = new AsaasHttpError(res.status, body);
      console.error(
        `[asaas] http ${res.status} ${opts.method ?? "GET"} ${opts.path} code=${err.code ?? "-"}`
      );
      throw err;
    }

    return sanitizeAsaasPayload(body) as T;
  } catch (err) {
    if (err instanceof AsaasNotConfiguredError || err instanceof AsaasHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AsaasHttpError(504, { message: "Tempo esgotado na chamada ao Asaas." });
    }
    // Erro de rede (DNS/ECONN) — sem detalhes sensíveis.
    throw new AsaasHttpError(502, { message: "Falha de rede ao chamar o Asaas." });
  } finally {
    clearTimeout(timer);
  }
}

export const asaasClient = {
  get: <T>(path: string, config?: AsaasConfig) => request<T>({ method: "GET", path, config }),
  post: <T>(path: string, body: unknown, config?: AsaasConfig) =>
    request<T>({ method: "POST", path, body, config }),
  put: <T>(path: string, body: unknown, config?: AsaasConfig) =>
    request<T>({ method: "PUT", path, body, config }),
  del: <T>(path: string, config?: AsaasConfig) => request<T>({ method: "DELETE", path, config }),
};
