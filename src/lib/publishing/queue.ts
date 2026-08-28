/**
 * FILA DE PUBLICAÇÃO — Fase 7 (Parte 4)
 * =====================================
 * Fila em banco (Vercel-compatível — sem Redis/BullMQ).
 *
 * Campos (Parte 4): content, platform, date/time, status, attempts,
 * last attempt, next attempt, error message, externalId, provider, timestamps.
 *
 * Regras:
 * - Um item por (contentId, platform) — `@@unique`.
 * - PROCESSANDO = tentativa real em andamento.
 * - PUBLICADO SÓ com confirmação do adapter (nunca por tempo).
 * - CANCELADO nunca publica.
 * - Retry controlado (Parte 5): máx. 3 tentativas, backoff, sem loop.
 */

import { pub } from "./db";
import { prisma } from "@/lib/db";
import { MAX_AUTO_ATTEMPTS, type QueueStatus } from "./types";
import { toPublishError } from "./errors";

export interface EnqueueInput {
  userId: string;
  contentId: string;
  platform: string;
  format: string;
  scheduledAt?: string | null;
}

export interface EnqueueResult {
  ok: boolean;
  queueId?: string;
  error?: string;
}

/**
 * Enfileira um conteúdo para publicação.
 * - Cria o item da fila com status AGENDADO (ou CANCELADO se a data já passou
 *   de forma definitiva — na verdade mantemos AGENDADO e deixamos o worker
 *   marcar como atrasado; nunca publicamos sem confirmação).
 * - Se já existir um item para (contentId, platform), apenas atualiza.
 */
export async function enqueuePublication(input: EnqueueInput): Promise<EnqueueResult> {
  const { userId, contentId, platform, format, scheduledAt } = input;

  // Owner-check: o conteúdo precisa pertencer ao usuário.
  const content = (await prisma.plannedContent.findUnique({
    where: { id: contentId },
  })) as unknown as { userId: string } | null;
  if (!content || content.userId !== userId) {
    return { ok: false, error: "Conteúdo não encontrado" };
  }

  const existing = await pub.queue.findUnique({
    where: { contentId_platform: { contentId, platform } },
  });

  const data = {
    userId,
    contentId,
    platform,
    format,
    status: "AGENDADO" as QueueStatus,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: scheduledAt ? new Date(scheduledAt) : null,
    errorCode: null,
    errorMessage: null,
    externalId: null,
    provider: null,
  };

  if (existing) {
    // Só atualiza se ainda não foi publicado/falhou definitivamente.
    if (existing.status === "PUBLICADO" || existing.status === "CANCELADO") {
      return { ok: false, error: "Este conteúdo já foi publicado ou cancelado." };
    }
    await pub.queue.update({
      where: { contentId_platform: { contentId, platform } },
      data: {
        format,
        scheduledAt: data.scheduledAt,
        status: "AGENDADO",
        nextAttemptAt: data.nextAttemptAt,
        errorCode: null,
        errorMessage: null,
      },
    });
    return { ok: true, queueId: existing.id };
  }

  const created = await pub.queue.create({ data });
  return { ok: true, queueId: created.id };
}

export interface QueueItemView {
  id: string;
  userId: string;
  contentId: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  externalId: string | null;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
}

function toView(row: {
  id: string;
  userId: string;
  contentId: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: Date | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  externalId: string | null;
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
}): QueueItemView {
  return {
    id: row.id,
    userId: row.userId,
    contentId: row.contentId,
    platform: row.platform,
    format: row.format,
    status: row.status,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    nextAttemptAt: row.nextAttemptAt ? row.nextAttemptAt.toISOString() : null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    externalId: row.externalId,
    provider: row.provider,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lista itens da fila do usuário (owner-check via userId). */
export async function listQueue(
  userId: string,
  filters?: {
    platform?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  }
): Promise<QueueItemView[]> {
  const where: Record<string, unknown> = { userId };
  if (filters?.platform) where.platform = filters.platform;
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.scheduledAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    } as unknown;
  }

  const rows = (await pub.queue.findMany({
    where,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: filters?.limit ?? 200,
  })) as unknown as Parameters<typeof toView>[0][];

  return rows.map(toView);
}

/** Busca um item da fila com owner-check. */
export async function getQueueItem(userId: string, queueId: string): Promise<QueueItemView | null> {
  const row = (await pub.queue.findUnique({ where: { id: queueId } })) as unknown as
    | (Parameters<typeof toView>[0] & { userId: string })
    | null;
  if (!row || row.userId !== userId) return null;
  return toView(row);
}

/** Marca um item da fila como CANCELADO (nunca publica). Owner-check. */
export async function cancelQueueItem(userId: string, queueId: string): Promise<QueueItemView | null> {
  const existing = (await pub.queue.findUnique({ where: { id: queueId } })) as unknown as {
    userId: string;
    status: string;
  } | null;
  if (!existing || existing.userId !== userId) return null;
  if (existing.status === "PUBLICADO") return getQueueItem(userId, queueId);

  const updated = await pub.queue.update({
    where: { id: queueId },
    data: { status: "CANCELADO" },
  });
  return toView(updated as unknown as Parameters<typeof toView>[0]);
}

/** Marca um item como PROCESSANDO e registra a tentativa (guard). */
export async function markProcessing(queueId: string): Promise<boolean> {
  const existing = (await pub.queue.findUnique({ where: { id: queueId } })) as unknown as {
    status: string;
  } | null;
  if (!existing) return false;
  if (existing.status === "CANCELADO") return false;
  await pub.queue.update({
    where: { id: queueId },
    data: { status: "PROCESSANDO", lastAttemptAt: new Date(), idempotencyKey: randomIdempotencyKey() },
  });
  return true;
}

/** Marca como PUBLICADO com confirmação real (externalId). */
export async function markPublished(queueId: string, externalId: string): Promise<void> {
  await pub.queue.update({
    where: { id: queueId },
    data: {
      status: "PUBLICADO",
      externalId,
      nextAttemptAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
}

/** Marca como FALHOU (com erro classificado) e agenda backoff se retryável. */
export async function markFailed(
  queueId: string,
  errorCode: string,
  errorMessage: string,
  attempts: number,
  retryable: boolean
): Promise<void> {
  const data: Record<string, unknown> = {
    status: "FALHOU",
    errorCode,
    errorMessage,
    attempts,
  };
  if (retryable && attempts < MAX_AUTO_ATTEMPTS) {
    // Backoff: 5min, 15min, 45min (exponencial simples).
    const delayMs = 5 * 60 * 1000 * Math.pow(3, attempts - 1);
    data.status = "AGENDADO";
    data.nextAttemptAt = new Date(Date.now() + delayMs);
    data.errorCode = errorCode;
    data.errorMessage = errorMessage;
  } else {
    data.nextAttemptAt = null;
  }
  await pub.queue.update({ where: { id: queueId }, data });
}

function randomIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export { toPublishError };
