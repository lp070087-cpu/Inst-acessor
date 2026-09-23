import { IntegrationConfigError } from "./errors";

/**
 * Cliente HTTP da API do Instagram (Instagram Business Login / Instagram API).
 * ==========================================================================
 * Este arquivo usa EXCLUSIVAMENTE os hosts oficiais do Instagram Business Login:
 *
 *   - `https://graph.instagram.com`  → dados, insights e publicação
 *   - `https://api.instagram.com`    → troca do `code` por access token
 *
 * NÃO usa `graph.facebook.com` nem o dialog de Facebook Login. O app Meta
 * "Inst Acessor" foi criado com o caso de uso "Gerenciar mensagens e conteúdo
 * no Instagram", cujo fluxo é o Instagram Business Login — a conta autorizada é
 * a própria conta profissional do Instagram, SEM exigir Página do Facebook.
 *
 * - Timeout via AbortSignal.
 * - Retries controlados para falhas transitórias (429/5xx/network).
 * - Rate limit: respeita cabeçalho X-App-Usage quando presente.
 * - Não expõe credenciais.
 */

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v21.0";

/** Host da API de dados/insights/publicação do Instagram. */
export const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com";

/** Host da API de OAuth (troca de code por token) do Instagram. */
export const INSTAGRAM_OAUTH_BASE = "https://api.instagram.com";

/**
 * Host do diálogo de autorização do Instagram Business Login.
 * Exposto para testes determinísticos do fluxo OAuth.
 */
export const INSTAGRAM_AUTHORIZE_BASE = "https://www.instagram.com";

const FETCH_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export class InstagramApiError extends Error {
  code?: string | number;
  retryable?: boolean;
  /**
   * `subcode`, `type` e `fbtrace_id` da Meta.
   *
   * Existem para DIAGNÓSTICO e não para o usuário: `subcode` é o que distingue
   * "campo inválido nesta chamada" de "objeto não encontrado", informação que o
   * `code` sozinho não dá. São metadata do erro — não contêm credencial, corpo
   * de resposta nem dado do usuário, então podem ser registrados com segurança.
   */
  subcode?: string;
  type?: string;
  fbtraceId?: string;
  constructor(
    message: string,
    code?: string | number,
    retryable = false,
    meta?: { subcode?: string; type?: string; fbtraceId?: string }
  ) {
    super(message);
    this.name = "InstagramApiError";
    this.code = code;
    this.retryable = retryable;
    this.subcode = meta?.subcode;
    this.type = meta?.type;
    this.fbtraceId = meta?.fbtraceId;
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

/**
 * Credenciais do app Meta/Instagram.
 *
 * PRIORIDADE OFICIAL (novo app):
 *   1. `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`  ← novo app Instagram
 *   2. `META_APP_ID`      / `META_APP_SECRET`       ← compatibilidade temporária
 *
 * O app do Instagram Business Login tem credenciais próprias. As variáveis
 * `META_APP_*` continuam aceitas para não quebrar ambientes existentes, mas o
 * par PRIORITÁRIO para o novo app é `INSTAGRAM_APP_*`. Remova o par antigo do
 * ambiente quando a migração terminar.
 */
export function getMetaCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new IntegrationConfigError(
      "Instagram não configurado no servidor (INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET)."
    );
  }
  return { appId, appSecret };
}

/**
 * App Secret usado na validação da assinatura do webhook (`X-Hub-Signature-256`).
 * Mesma prioridade de `getMetaCredentials`, porém tolerante à ausência —
 * o chamador decide o que fazer quando não estiver configurado.
 */
export function getWebhookAppSecret(): string {
  return (
    process.env.INSTAGRAM_APP_SECRET ||
    process.env.META_APP_SECRET ||
    ""
  ).trim();
}

/**
 * Redirect URI do OAuth.
 * Exige valor EXPLÍCITO — nunca inventa/hardcode (dev e produção são
 * ambientes distintos e o valor precisa bater com o cadastrado no Meta).
 */
export function getRedirectUri(): string {
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!redirectUri) {
    throw new IntegrationConfigError("INSTAGRAM_REDIRECT_URI não configurada no servidor.");
  }
  return redirectUri;
}

/**
 * Remove qualquer credencial de um texto antes de ele ir para log.
 *
 * Segunda linha de defesa: o `path` recebido por `graphGet` nunca deveria conter
 * token (quem o anexa é esta função), mas um `paging.next` devolvido pela Meta
 * VEM com `access_token` embutido. Se uma URL dessas chegar aqui por engano, o
 * log não pode ser o vazamento.
 */
function redactToken(text: string): string {
  return text.replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]");
}

/**
 * Registra um erro da Meta para diagnóstico, SEM credencial.
 *
 * O que sai: endpoint lógico, media id, status HTTP, code, subcode, type,
 * mensagem sanitizada e fbtrace id. O que NUNCA sai: access token, secret,
 * senha, header de autorização, cookies e corpo completo da resposta — a
 * mensagem da Meta é metadata do erro, não payload.
 */
function logMetaError(params: {
  path: string;
  status: number;
  code: string;
  subcode?: string;
  type?: string;
  message: string;
  fbtraceId?: string;
  attempt: number;
}): void {
  console.warn("[instagram-client] erro da Meta", {
    // `path` já vem sem o token: quem o anexa é o graphGet, depois desta linha.
    endpoint: redactToken(params.path.split("?")[0]),
    status: params.status,
    code: params.code,
    subcode: params.subcode ?? "-",
    type: params.type ?? "-",
    fbtraceId: params.fbtraceId ?? "-",
    attempt: params.attempt + 1,
    message: redactToken(params.message).slice(0, 300),
  });
}

/**
 * GET na API do Instagram com retries e timeout.
 * @throws InstagramApiError
 */
export async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/${path}${
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

        // Diagnóstico do erro REAL: sem isto, um 400 por campo inválido era
        // indistinguível de um 400 por objeto inexistente, e a tela escolhia a
        // mensagem errada. `subcode` é o campo que separa os dois casos.
        const meta = {
          subcode:
            data?.error?.error_subcode != null ? String(data.error.error_subcode) : undefined,
          type: data?.error?.type != null ? String(data.error.type) : undefined,
          fbtraceId:
            data?.error?.fbtrace_id != null ? String(data.error.fbtrace_id) : undefined,
        };

        logMetaError({
          path,
          status: res.status,
          code,
          subcode: meta.subcode,
          type: meta.type,
          message,
          fbtraceId: meta.fbtraceId,
          attempt,
        });

        if (retryable && attempt < MAX_RETRIES) {
          lastError = new InstagramApiError(message, code, true, meta);
          continue;
        }

        throw new InstagramApiError(message, code, retryable, meta);
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

/**
 * GET na API do Instagram sem retries (para troca de token — 1 chamada).
 *
 * A resposta é lida como TEXTO e convertida com `JSON.parse` protegido: se o
 * host devolver uma página de erro (gateway/proxy em HTML) em vez de JSON, o
 * chamador recebe um erro controlado em vez de uma exceção crua de parse.
 * O corpo bruto nunca é repassado — apenas a indicação do status.
 */
export async function graphGetNoRetry<T>(url: string): Promise<T & { error?: Record<string, unknown> }> {
  const res = await fetch(url, { method: "GET", signal: timeoutSignal() });

  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: Record<string, unknown> };
  } catch {
    return {
      error: { message: "Resposta inválida do Instagram.", code: res.status },
    } as T & { error?: Record<string, unknown> };
  }
}

/**
 * POST `application/x-www-form-urlencoded` sem retries.
 * Usado na troca do `code` por token (`api.instagram.com/oauth/access_token`),
 * que é o formato oficial exigido por esse endpoint.
 *
 * O corpo é enviado no body (nunca na query) — o app secret não vai para logs
 * de URL nem para o histórico do servidor.
 */
export async function postFormNoRetry<T>(
  url: string,
  form: Record<string, string>
): Promise<T & { error?: Record<string, unknown>; error_message?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: timeoutSignal(),
  });

  const text = await res.text();
  try {
    return JSON.parse(text) as T & {
      error?: Record<string, unknown>;
      error_message?: string;
    };
  } catch {
    // Resposta não-JSON: devolve um erro controlado (nunca o corpo bruto).
    return {
      error: { message: "Resposta inválida do Instagram.", code: res.status },
    } as T & { error?: Record<string, unknown> };
  }
}

export { GRAPH_VERSION as INSTAGRAM_GRAPH_VERSION, FETCH_TIMEOUT_MS };
