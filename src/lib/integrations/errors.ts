/**
 * Classificação central de erros da integração com o Instagram (Meta).
 *
 * Regras:
 * - Nunca expõe token, secret ou detalhes internos ao cliente.
 * - Logs seguros: apenas código/tipo, nunca credenciais.
 * - Mapeia erros para mensagens amigáveis + HTTP status controlado.
 */

export type IntegrationErrorCode =
  | "missing_config"
  | "invalid_state"
  | "state_expired"
  | "denied"
  | "missing_code"
  | "token_exchange"
  | "token_invalid"
  | "token_expired"
  | "not_compatible"
  | "account_fetch"
  | "meta_error"
  | "timeout"
  | "network"
  | "server";

export interface IntegrationErrorInfo {
  code: IntegrationErrorCode;
  httpStatus: number;
  userMessage: string;
  /** Código retornado pela Meta (190 = token inválido, etc.). */
  metaCode?: string | number;
}

/** Erros de token inválido/expirado retornados pela Graph API. */
const INVALID_TOKEN_META_CODES = new Set<string | number>([
  190, // OAuthException — sessão expirada/inválida
  "190",
  "SESSION_EXPIRED",
  "SESSION_INVALID",
  "TOKEN_INVALID",
  "ACCESS_TOKEN_EXPIRED",
]);

/**
 * Classifica um erro da API Meta/Instagram em uma informação segura.
 * `err` deve ser uma instância de InstagramApiError (ou similar).
 */
export function classifyIntegrationError(
  err: unknown,
  metaCode?: string | number
): IntegrationErrorInfo {
  // Timeout explícito da nossa camada fetch.
  if (isTimeoutError(err)) {
    return {
      code: "timeout",
      httpStatus: 504,
      userMessage: "A Meta demorou para responder. Tente novamente em instantes.",
    };
  }

  // Falha de rede sem resposta da Meta.
  if (isNetworkError(err)) {
    return {
      code: "network",
      httpStatus: 502,
      userMessage: "Não foi possível falar com o Instagram agora. Tente novamente.",
    };
  }

  const code = metaCode ?? (err as { code?: string | number })?.code;

  if (typeof code !== "undefined" && INVALID_TOKEN_META_CODES.has(code)) {
    return {
      code: "token_invalid",
      httpStatus: 401,
      userMessage: "O acesso ao Instagram expirou ou não é mais válido. Conecte novamente.",
      metaCode: code,
    };
  }

  // Erro de configuração do servidor.
  if (
    typeof code === "string" &&
    (code.includes("CONFIG") || code.includes("MISSING"))
  ) {
    return {
      code: "missing_config",
      httpStatus: 500,
      userMessage: "A integração ainda não está configurada no servidor.",
      metaCode: code,
    };
  }

  return {
    code: "meta_error",
    httpStatus: 502,
    userMessage: "O Instagram retornou um erro. Tente novamente em instantes.",
    metaCode: code,
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

/** Mapeia um IntegrationErrorCode para o query param de erro da UI. */
export function toErrorParam(code: IntegrationErrorCode): string {
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
    case "not_compatible":
      return "not_compatible";
    case "account_fetch":
      return "account_fetch";
    case "missing_config":
      return "config";
    case "timeout":
    case "network":
    case "meta_error":
    case "server":
    default:
      return "server";
  }
}
