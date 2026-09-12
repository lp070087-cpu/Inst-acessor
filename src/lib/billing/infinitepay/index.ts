/**
 * INFINITEPAY — BARREL PÚBLICO (server-only)
 * ===========================================
 * Camada de integração com o InfinitePay (gateway oficial desde 2026-08-31).
 * NENHUM destes módulos deve ser importado em client component — contêm
 * segredos do servidor.
 */

export {
  getInfinitePayConfig,
  infinitepayStatus,
  INFINITEPAY_PAYMENT_CHECK_URL,
  type InfinitePayConfig,
} from "./config";

export {
  checkPayment,
  InfinitePayHttpError,
  INFINITEPAY_TIMEOUT_MS,
  type PaymentCheckResult,
} from "./client";

export {
  parseInfinitePayWebhook,
  sanitizeInfinitePayPayload,
  type ParsedInfinitePayEvent,
} from "./webhook";

export {
  handleInfinitePayEvent,
  INFINITEPAY_PROVIDER,
  INFINITEPAY_SOURCE,
  type ProcessInfinitePayEventResult,
} from "./events";
