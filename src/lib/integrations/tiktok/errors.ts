/**
 * Classificação central de erros da integração com o TikTok.
 * Mesma filosofia do Instagram:
 * - Nunca expõe token, secret ou detalhes internos.
 * - Logs seguros (apenas código, nunca credenciais).
 * - Mapeia erros para mensagens amigáveis + HTTP status controlado.
 */

export type TikTokErrorCode =
  | "missing_config"
  | "invalid_state"
  | "state_expired"
  | "denied"
  | "missing_code"
  | "token_exchange"
  | "token_invalid"
  | "token_expired"
  | "account_fetch"
  | "api_error"
  | "timeout"
  | "network"
  | "server";

export interface TikTokErrorInfo {
  code: TikTokErrorCode;
  httpStatus: number;
  userMessage: string;
  /** Código retornado pelo TikTok, quando disponível. */
  apiCode?: string | number;
}

/** Códigos de token inválido/expirado da API do TikTok. */
const INVALID_TOKEN_CODES = new Set<string | number>([
  "invalid_token",
  "access_token_invalid",
  "token_expired",
  "unauthorized",
  401,
]);

export function classifyTikTokError(
  err: unknown,
  apiCode?: string | number
): TikTokErrorInfo {
  if (isTimeoutError(err)) {
    return {
      code: "timeout",
      httpStatus: 504,
      userMessage: "O TikTok demorou para responder. Tente novamente em instantes.",
    };
  }

  if (isNetworkError(err)) {
    return {
      code: "network",
      httpStatus: 502,
      userMessage: "Não foi possível falar com o TikTok agora. Tente novamente.",
    };
  }

  const code = apiCode ?? (err as { code?: string | number })?.code;

  if (typeof code !== "undefined" && INVALID_TOKEN_CODES.has(code)) {
    return {
      code: "token_invalid",
      httpStatus: 401,
      userMessage: "O acesso ao TikTok expirou ou não é mais válido. Conecte novamente.",
      apiCode: code,
    };
  }

  if (
    typeof code === "string" &&
    (code.includes("CONFIG") || code.includes("MISSING"))
  ) {
    return {
      code: "missing_config",
      httpStatus: 500,
      userMessage: "A integração ainda não está configurada no servidor.",
      apiCode: code,
    };
  }

  return {
    code: "api_error",
    httpStatus: 502,
    userMessage: "O TikTok retornou um erro. Tente novamente em instantes.",
    apiCode: code,
  };
}

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"))
  );
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error && err.message.toLowerCase().includes("rede")) return true;
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) return true;
  return false;
}

/** Mapeia um TikTokErrorCode para o query param de erro da UI. */
export function toTikTokErrorParam(code: TikTokErrorCode): string {
  switch (code) {
    case "denied":
      return "denied";
    case "missing_code":
      return "missing_code";
    case "invalid_state":
      return "invalid_state";
    case "state_expired":
      return "state_expired";
    case "token_exchange":
      return "token_exchange";
    case "token_invalid":
    case "token_expired":
      return "token_invalid";
    case "account_fetch":
      return "account_fetch";
    case "missing_config":
      return "config";
    case "timeout":
    case "network":
    case "api_error":
    case "server":
    default:
      return "server";
  }
}

/** Erro de configuração do servidor (TikTok não configurado). */
export class IntegrationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationConfigError";
  }
}
