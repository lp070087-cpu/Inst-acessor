/**
 * RETRY CONTROLADO — Fase 7 (Parte 5)
 * ===================================
 * - Máx. 3 tentativas automáticas por item.
 * - Backoff exponencial simples (5min → 15min → 45min).
 * - Sem loop infinito.
 * - Erros PERMANENT / AUTH / VALIDATION / INTEGRATION_NOT_CONFIGURED NÃO são
 *   re-tentados automaticamente.
 * - Cada tentativa fica registrada (PublishLog).
 */

import { pub } from "./db";
import { MAX_AUTO_ATTEMPTS } from "./types";
import { isRetryableCode } from "./errors";

export interface RetryDecision {
  shouldRetry: boolean;
  attempts: number;
  nextAttemptAt: Date | null;
}

/**
 * Decide se um item deve ser re-tentado após uma falha.
 * - Se já atingiu MAX_AUTO_ATTEMPTS → não.
 * - Se o código de erro não é retryável → não.
 * - Caso contrário, agenda backoff e retorna true.
 */
export function decideRetry(
  errorCode: string,
  attempts: number
): RetryDecision {
  if (attempts >= MAX_AUTO_ATTEMPTS) {
    return { shouldRetry: false, attempts, nextAttemptAt: null };
  }
  if (!isRetryableCode(errorCode as never)) {
    return { shouldRetry: false, attempts, nextAttemptAt: null };
  }
  const delayMs = 5 * 60 * 1000 * Math.pow(3, attempts - 1);
  return {
    shouldRetry: true,
    attempts,
    nextAttemptAt: new Date(Date.now() + delayMs),
  };
}

/** Registra uma tentativa no PublishLog (sem segredos). */
export async function logAttempt(input: {
  userId: string;
  queueId: string;
  contentId?: string | null;
  platform: string;
  operation: string;
  status: "success" | "error" | "skipped";
  attempts: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  externalId?: string | null;
  provider?: string | null;
}): Promise<void> {
  await pub.log.create({
    data: {
      userId: input.userId,
      queueId: input.queueId,
      contentId: input.contentId ?? null,
      platform: input.platform,
      operation: input.operation,
      status: input.status,
      attempts: input.attempts,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      externalId: input.externalId ?? null,
      provider: input.provider ?? null,
    },
  });
}

export { MAX_AUTO_ATTEMPTS };
