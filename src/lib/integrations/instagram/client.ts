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
 * - Retries controlados e LIMITADOS por classe de falha: 5xx/rede com backoff
 *   exponencial; 429 com MENOS retentativas e espera MAIOR (respeita
 *   `Retry-After` quando presente). 429 é tratado de forma distinta do 5xx de
 *   propósito: insistir num rate limit é o que atrai mais rate limit.
 * - Uso reportado pela Meta (`X-App-Usage` / `X-Business-Use-Case-Usage`) é
 *   LIDO: perto do teto, as retentativas de rate limit param (stop early) em vez
 *   de martelar a API.
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

/**
 * Retentativas de RATE LIMIT (429).
 *
 * Distinto de `MAX_RETRIES`: um 429 é um pedido EXPLÍCITO de "pare" e, por isso,
 * tem teto próprio e MENOR. O backoff também é maior — repetir rápido contra um
 * rate limit só o prolonga. Este teto vale para `graphGet`; quem quiser um
 * orçamento diferente (ex.: o sync) passa `maxRateLimitRetries`.
 */
const MAX_RATE_LIMIT_RETRIES = 1;
/** Base do backoff para 429, em ms — maior que a base de 5xx/rede. */
const RATE_LIMIT_BASE_DELAY_MS = 2000;
/** Teto do backoff (mesmo com `Retry-After` gigante) — rede, não fila eterna. */
const MAX_RATE_LIMIT_DELAY_MS = 60000;

/**
 * Limiar de uso do app (percentual) a partir do qual as retentativas de rate
 * limit param. Não bloqueia a primeira chamada: apenas impede INSISTIR quando a
 * Meta já avisou que a cota está no limite — o caminho mais rápido para um
 * bloqueio. Fail-open quando o percentual não é informado.
 */
export const APP_USAGE_SLOWDOWN_PERCENT = 85;

/** Resultado (sanitizado) dos cabeçalhos de uso da Meta. */
interface AppUsageReading {
  /** Maior percentual informado (0–110), ou `null` se ausente/ilegível. */
  percent: number | null;
  /** `call_count` quando informado; é ele que a Meta "acumula" entre chamadas. */
  callCount: number | null;
}

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Lê os cabeçalhos de uso da Meta.
 *
 * `X-App-Usage` (formato legado) traz `call_count`/`total_time`/`total_cputime`;
 * `X-Business-Use-Case-Usage` (formato novo) pode trazer os mesmos campos
 * aninhados por caso de uso. Aqui extraímos apenas o MAIOR percentual e o maior
 * `call_count` — nunca logamos o valor bruto (pode conter chaves de app/conta).
 * Qualquer valor não numérico ou fora de faixa é descartado (ausência honesta).
 */
function readAppUsage(headers: Headers): AppUsageReading {
  const values: number[] = [];
  const callCounts: number[] = [];

  const collect = (raw: string | null): void => {
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      for (const value of Object.values(node as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (value && typeof value === "object") {
          visit(value);
        } else if (typeof value === "number") {
          values.push(value);
        }
      }
    };
    visit(parsed);
    // `call_count` é o que a Meta acumula; extraímos separado para permitir a
    // pausa defensiva quando ele está perto do teto mesmo sem percentual.
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "call_count" && typeof v === "number") callCounts.push(v);
        else if (v && typeof v === "object") walk(v);
      }
    };
    walk(parsed);
  };

  collect(headers.get("X-App-Usage"));
  collect(headers.get("X-Business-Use-Case-Usage"));

  const percent = values.length > 0 ? Math.max(...values) : null;
  const callCount = callCounts.length > 0 ? Math.max(...callCounts) : null;
  return { percent, callCount };
}

/** `Retry-After` em segundos, respeitado com teto; `null` quando ausente. */
function retryAfterMs(res: Response): number | null {
  const header = res.headers.get("Retry-After");
  if (!header) return null;
  const seconds = Number(header.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return clamp(seconds * 1000, 0, MAX_RATE_LIMIT_DELAY_MS);
}

/**
 * Espera para uma tentativa que falhou.
 *
 *   429 → prefere `Retry-After`; sem ele, base MAIOR (`RATE_LIMIT_BASE_DELAY_MS`)
 *          com crescimento exponencial por tentativa de rate limit.
 *   5xx / rede → base de 500ms com crescimento exponencial (comportamento antigo).
 */
function backoffDelay(params: {
  status: number | null;
  attempt: number;
  rateLimitAttempt: number;
  retryAfterMs: number | null;
}): number {
  if (params.status === 429) {
    if (params.retryAfterMs != null) return params.retryAfterMs;
    const exp = RATE_LIMIT_BASE_DELAY_MS * 2 ** params.rateLimitAttempt;
    return clamp(exp, 0, MAX_RATE_LIMIT_DELAY_MS);
  }
  return RETRY_BASE_DELAY_MS * 2 ** (params.attempt - 1);
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
 * Opções de `graphGet`.
 *
 * `onErrorResponse` recebe o objeto `error` CRU da Meta quando a resposta não é
 * OK. Existe porque o `InstagramApiError` carrega só os campos que a UI precisa
 * (message/code/subcode/type) — e alguns defeitos só se explicam por um campo
 * que ele não guarda. Caso concreto: o `/insights` devolve, em `error_data`, a
 * LISTA de métricas válidas quando a métrica pedida foi aposentada; sem esse
 * campo o 400 é indistinguível de um problema de escopo.
 *
 * É um hook de DIAGNÓSTICO: não altera o fluxo do erro — o `InstagramApiError`
 * continua sendo lançado normalmente depois dele.
 */
export interface GraphGetOptions {
  onErrorResponse?: (error: Record<string, unknown>) => void;
  /**
   * Orçamento de retentativas para 429 (rate limit). Ausente →
   * `MAX_RATE_LIMIT_RETRIES`. O sync de métricas passa um valor MENOR para
   * reduzir o total de chamadas disparadas num pico de rate limit.
   */
  maxRateLimitRetries?: number;
}

/**
 * GET na API do Instagram com retries e timeout.
 *
 * Duas classes de retry, com orçamentos SEPARADOS (um 429 não consome o do 5xx):
 *   - 5xx / rede → até `MAX_RETRIES`, backoff exponencial de 500ms;
 *   - 429       → até `maxRateLimitRetries`, espera maior e `Retry-After`
 *                 respeitado; as retentativas de rate limit PARAM quando o uso
 *                 reportado pela Meta (`X-App-Usage`) está alto (stop early).
 *
 * @throws InstagramApiError
 */
export async function graphGet<T>(
  path: string,
  accessToken: string,
  options?: GraphGetOptions
): Promise<T> {
  const url = `${INSTAGRAM_GRAPH_BASE}/${GRAPH_VERSION}/${path}${
    path.includes("?") ? "&" : "?"
  }access_token=${encodeURIComponent(accessToken)}`;

  const maxRateLimitRetries = options?.maxRateLimitRetries ?? MAX_RATE_LIMIT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;

    try {
      res = await fetch(url, { method: "GET", signal: timeoutSignal() });
    } catch (error) {
      // Timeout / rede — tenta novamente se ainda houver tentativas gerais.
      const transient = isAbort(error) || error instanceof TypeError;
      const timeoutMessage = isAbort(error)
        ? "A API do Instagram demorou para responder."
        : "Falha de rede ao consultar a API do Instagram.";
      const timeoutCode = isAbort(error) ? "TIMEOUT" : "NETWORK";
      if (transient && attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
        lastError = new InstagramApiError(timeoutMessage, timeoutCode, true);
        continue;
      }
      throw new InstagramApiError(timeoutMessage, timeoutCode);
    }

    // Inalcançável (o catch acima sempre retorna/continua), mas mantém o tipo
    // de `res` não-nulo sem depender da análise de fluxo entre try/catch.
    if (!res) throw new InstagramApiError("Falha ao consultar a API do Instagram.", "UNKNOWN");

    // Uso reportado pela Meta — lido SEMPRE, não só no caminho de erro.
    const usage = readAppUsage(res.headers);
    if (usage.percent != null && usage.percent >= APP_USAGE_SLOWDOWN_PERCENT) {
      // Só o percentual — nunca o valor bruto do cabeçalho (pode conter chaves).
      console.warn(
        `[instagram-client] uso do app em ${usage.percent}%${usage.callCount != null ? ` (call_count ${usage.callCount})` : ""} — desacelerando`
      );
    }

    const data = (await res.json().catch(() => ({}))) as T & { error?: Record<string, unknown> };

    if (!res.ok || data.error) {
      const code = String(data?.error?.code ?? data?.error?.type ?? res.status);
      const message = String(data?.error?.message ?? "A API do Instagram retornou um erro.");
      // Distingue 429 (código HTTP ou code 4/17/32/613 da Meta) de 5xx.
      const metaNumberCode = typeof data.error?.code === "number" ? data.error.code : null;
      const isRateLimit =
        res.status === 429 || metaNumberCode === 4 || metaNumberCode === 17 || metaNumberCode === 32 || metaNumberCode === 613;
      const retryable =
        isRetryableStatus(res.status) || (metaNumberCode != null && metaNumberCode >= 500);

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

      // Hook de diagnóstico: o chamador vê o erro CRU (só leitura/log), o
      // fluxo de erro abaixo segue idêntico. Envolvido em try/catch para que
      // uma falha do próprio log nunca derrube a requisição.
      if (options?.onErrorResponse && data?.error) {
        try {
          options.onErrorResponse(data.error);
        } catch {
          /* diagnóstico é best-effort — jamais esconde o erro real */
        }
      }

      if (isRateLimit) {
        // Stop early: o uso alto pode ser do consumidor (call_count) e não do
        // percentual de CPU do app — nesse caso `percent` fica baixo e não
        // freia. Por isso o teto de retentativas de rate limit é o que segura
        // de verdade, e o sinal de uso apenas o encurta quando disponível.
        const usageHigh = usage.percent != null && usage.percent >= APP_USAGE_SLOWDOWN_PERCENT;
        const canRetry = attempt < maxRateLimitRetries && !usageHigh;
        if (canRetry) {
          const wait = backoffDelay({
            status: 429,
            attempt,
            rateLimitAttempt: attempt,
            retryAfterMs: retryAfterMs(res),
          });
          console.warn(
            `[instagram-client] 429 — aguardando ${wait}ms antes de re-tentar (tentativa ${attempt + 1}/${maxRateLimitRetries})`
          );
          await delay(wait);
          lastError = new InstagramApiError(message, code, true, meta);
          continue;
        }
        throw new InstagramApiError(message, code, true, meta);
      }

      if (retryable && attempt < MAX_RETRIES) {
        lastError = new InstagramApiError(message, code, true, meta);
        await delay(backoffDelay({ status: res.status, attempt, rateLimitAttempt: 0, retryAfterMs: null }));
        continue;
      }

      throw new InstagramApiError(message, code, retryable, meta);
    }

    return data;
  }
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
