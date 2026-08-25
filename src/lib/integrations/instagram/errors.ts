/**
 * Erros específicos da integração Instagram.
 * Reutiliza o classificador central (integrations/errors.ts) para
 * mapear erros em mensagens seguras e HTTP status controlados.
 */

export { InstagramApiError } from "./client";

export class IntegrationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationConfigError";
  }
}

export {
  classifyIntegrationError,
  toErrorParam,
  type IntegrationErrorCode,
  type IntegrationErrorInfo,
} from "../errors";
