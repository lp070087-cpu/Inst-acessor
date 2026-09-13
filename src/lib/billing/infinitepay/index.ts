/**
 * INFINITEPAY — BARREL PÚBLICO (server-only)
 * ===========================================
 * Camada de integração com o InfinitePay — HISTÓRICO, fora dos fluxos ativos.
 * O GATEWAY OFICIAL é o ASAAS (`src/lib/billing/asaas/**`). Este módulo segue
 * no repositório apenas para não perder eventos antigos e manter o histórico
 * consistente com os registros do banco.
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
