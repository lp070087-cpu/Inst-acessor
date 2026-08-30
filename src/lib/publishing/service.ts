/**
 * SERVIÇO CENTRAL DE PUBLICAÇÃO — Fase 7 (Parte 2)
 * =================================================
 * Funções públicas consumidas por APIs e UI:
 *   publishContent            — publica agora (via fila + adapter).
 *   scheduleContent           — agenda (cria item na fila).
 *   cancelScheduledContent    — cancela (CANCELADO nunca publica).
 *   retryPublication          — re-tenta uma publicação falhada.
 *   getPublicationStatus      — status real (fila + adapter quando possível).
 *   processQueue              — processa itens vencidos (worker/cron).
 *
 * Flows:
 *   Preview/Calendário → scheduleContent → fila → (worker) → adapter →
 *   confirmação real → PUBLICADO.
 *
 * Segurança: userId da sessão é a fonte de verdade. Logs sem segredos.
 */

import { pub } from "./db";
import { prisma } from "@/lib/db";
import { enqueuePublication, getQueueItem, markProcessing, markPublished, markFailed, listQueue } from "./queue";
import { decideRetry, logAttempt } from "./retry";
import { getAdapter } from "./adapters";
import { friendlyMessage, sanitizeMessage, toPublishError } from "./errors";
import { MAX_AUTO_ATTEMPTS, type PublishPayload } from "./types";

// ------------------------------------------------------------
// Tipos públicos
// ------------------------------------------------------------

export interface PublishContentInput {
  userId: string;
  contentId: string;
  platform: string;
  format: string;
  caption: string;
  hashtags?: string;
  mediaUrl?: string;
  mediaCount?: number;
  mimeType?: string;
  mediaItems?: PublishPayload["mediaItems"];
}

export interface PublishContentResult {
  ok: boolean;
  status?: string;
  queueId?: string;
  externalId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ScheduleContentInput {
  userId: string;
  contentId: string;
  platform: string;
  format: string;
  scheduledAt?: string | null;
}

export interface RetryPublicationInput {
  userId: string;
  queueId: string;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

async function loadContent(userId: string, contentId: string) {
  const content = (await prisma.plannedContent.findUnique({
    where: { id: contentId },
  })) as unknown as {
    id: string;
    userId: string;
    platform: string;
    format: string;
    title: string;
    draftId: string | null;
    copyId: string | null;
    scheduledAt: Date | null;
  } | null;
  if (!content || content.userId !== userId) return null;
  return content;
}

async function buildPayload(
  userId: string,
  content: { id: string; platform: string; format: string; draftId: string | null; copyId: string | null },
  extra?: { caption?: string; hashtags?: string; mediaUrl?: string; mediaCount?: number; mimeType?: string; mediaItems?: PublishPayload["mediaItems"] }
): Promise<PublishPayload> {
  // Preferência: dados explícitos (do Preview) → fallback para o draft vinculado.
  let caption = extra?.caption ?? "";
  let hashtags = extra?.hashtags ?? "";
  let mediaUrl = extra?.mediaUrl ?? "";
  let mediaCount = extra?.mediaCount ?? 0;
  let mimeType = extra?.mimeType;
  let mediaItems = extra?.mediaItems;

  if (!caption && content.draftId) {
    const draft = (await prisma.socialDraft.findUnique({
      where: { id: content.draftId },
    })) as unknown as {
      userId: string;
      caption: string | null;
      hashtags: string | null;
      mediaUrl: string | null;
      mediaType: string;
      items?: unknown;
    } | null;
    if (draft && draft.userId === userId) {
      caption = draft.caption ?? "";
      hashtags = draft.hashtags ?? "";
      mediaUrl = draft.mediaUrl ?? "";
      mediaCount = Array.isArray(draft.items) ? (draft.items as unknown[]).length : (mediaUrl ? 1 : 0);
      mimeType = draft.mediaType === "video" ? "video/mp4" : "image/jpeg";
      if (Array.isArray(draft.items)) {
        mediaItems = (draft.items as { mediaUrl: string; mediaType?: string }[]).map((it) => ({
          mediaUrl: it.mediaUrl,
          mimeType: it.mediaType === "video" ? "video/mp4" : "image/jpeg",
          mediaType: it.mediaType === "video" ? ("video" as const) : ("image" as const),
        }));
      }
    }
  }

  return {
    contentId: content.id,
    platform: content.platform,
    format: content.format,
    caption,
    hashtags,
    mediaUrl,
    mediaCount,
    mimeType,
    mediaItems,
  };
}

// ------------------------------------------------------------
// 1) Publicar agora
// ------------------------------------------------------------

export async function publishContent(input: PublishContentInput): Promise<PublishContentResult> {
  const content = await loadContent(input.userId, input.contentId);
  if (!content) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Conteúdo não encontrado." };
  }

  const payload = await buildPayload(input.userId, content, {
    caption: input.caption,
    hashtags: input.hashtags,
    mediaUrl: input.mediaUrl,
    mediaCount: input.mediaCount,
    mimeType: input.mimeType,
    mediaItems: input.mediaItems,
  });

  const adapter = getAdapter(input.platform);
  if (!adapter) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Plataforma não suportada." };
  }

  // Validação local (sem rede).
  const validation = adapter.validate(payload);
  if (!validation.valid) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: validation.errors[0] ?? "Conteúdo inválido." };
  }

  // Enfileira e processa em seguida.
  const enqueued = await enqueuePublication({
    userId: input.userId,
    contentId: input.contentId,
    platform: input.platform,
    format: input.format,
    scheduledAt: new Date().toISOString(),
  });
  if (!enqueued.ok || !enqueued.queueId) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: enqueued.error ?? "Não foi possível enfileirar." };
  }

  return processQueueItem(input.userId, enqueued.queueId);
}

// ------------------------------------------------------------
// 2) Agendar
// ------------------------------------------------------------

export async function scheduleContent(input: ScheduleContentInput): Promise<PublishContentResult> {
  const content = await loadContent(input.userId, input.contentId);
  if (!content) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Conteúdo não encontrado." };
  }

  const enqueued = await enqueuePublication({
    userId: input.userId,
    contentId: input.contentId,
    platform: input.platform,
    format: input.format,
    scheduledAt: input.scheduledAt,
  });
  if (!enqueued.ok) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: enqueued.error ?? "Não foi possível agendar." };
  }

  await logAttempt({
    userId: input.userId,
    queueId: enqueued.queueId ?? "",
    contentId: input.contentId,
    platform: input.platform,
    operation: "schedule",
    status: "success",
    attempts: 0,
    provider: input.platform,
  });

  return { ok: true, status: "AGENDADO", queueId: enqueued.queueId };
}

// ------------------------------------------------------------
// 3) Cancelar agendado
// ------------------------------------------------------------

export async function cancelScheduledContent(
  userId: string,
  queueId: string
): Promise<{ ok: boolean; error?: string }> {
  const item = await getQueueItem(userId, queueId);
  if (!item) return { ok: false, error: "Item não encontrado." };
  if (item.status === "PUBLICADO") return { ok: false, error: "Já publicado — não é possível cancelar." };

  const updated = await pub.queue.update({
    where: { id: queueId },
    data: { status: "CANCELADO", nextAttemptAt: null },
  });

  await logAttempt({
    userId,
    queueId,
    contentId: item.contentId,
    platform: item.platform,
    operation: "cancel",
    status: "success",
    attempts: item.attempts,
    provider: item.platform,
  });

  return { ok: true };
}

// ------------------------------------------------------------
// 4) Re-tentar publicação falhada
// ------------------------------------------------------------

export async function retryPublication(input: RetryPublicationInput): Promise<PublishContentResult> {
  const item = await getQueueItem(input.userId, input.queueId);
  if (!item) return { ok: false, errorCode: "VALIDATION", errorMessage: "Item não encontrado." };
  if (item.status !== "FALHOU" && item.status !== "AGENDADO") {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Este item não está em estado de re-tentativa." };
  }
  if (item.status === "AGENDADO" && item.nextAttemptAt && item.nextAttemptAt > new Date().toISOString()) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Ainda está aguardando o horário agendado." };
  }

  return processQueueItem(input.userId, input.queueId);
}

// ------------------------------------------------------------
// 5) Status de publicação
// ------------------------------------------------------------

export async function getPublicationStatus(
  userId: string,
  contentId: string,
  platform: string
): Promise<PublishContentResult> {
  const items = await listQueue(userId, { platform });
  const item = items.find((i) => i.contentId === contentId);
  if (!item) {
    return { ok: false, status: "NÃO_AGENDADO", errorCode: "VALIDATION", errorMessage: "Este conteúdo não está na fila de publicação." };
  }

  const adapter = getAdapter(platform);
  let externalStatus: { status?: string } | null = null;
  if (adapter && item.externalId) {
    try {
      const st = await adapter.getStatus({
        contentId,
        platform,
        externalId: item.externalId,
      });
      if (st.ok && st.status) externalStatus = { status: st.status };
    } catch {
      externalStatus = null;
    }
  }

  return {
    ok: item.status === "PUBLICADO",
    status: item.status,
    queueId: item.id,
    externalId: item.externalId ?? undefined,
    errorCode: item.errorCode ?? undefined,
    errorMessage: item.errorMessage ?? undefined,
  };
}

// ------------------------------------------------------------
// 6) Processamento (worker)
// ------------------------------------------------------------

export interface ProcessQueueResult {
  processed: number;
  published: number;
  failed: number;
}

/**
 * Processa itens vencidos da fila (AGENDADO com nextAttemptAt <= now).
 * Chamado por API manual e por cron futuro. Nunca publica por tempo —
 * sempre via adapter com confirmação real.
 */
export async function processQueue(limit = 20): Promise<ProcessQueueResult> {
  const now = new Date();

  const due = (await pub.queue.findMany({
    where: {
      status: "AGENDADO",
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })) as unknown as {
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
    idempotencyKey: string | null;
  }[];

  let published = 0;
  let failed = 0;

  for (const item of due) {
    const result = await processQueueItem(item.userId, item.id);
    if (result.ok) published++;
    else failed++;
  }

  return { processed: due.length, published, failed };
}

/** Processa um único item da fila (publica via adapter). */
export async function processQueueItem(
  userId: string,
  queueId: string
): Promise<PublishContentResult> {
  // Marca como PROCESSANDO (guarda contra corrida/cancelamento).
  const marked = await markProcessing(queueId);
  if (!marked) {
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Não foi possível processar este item." };
  }

  const item = await getQueueItem(userId, queueId);
  if (!item) return { ok: false, errorCode: "VALIDATION", errorMessage: "Item não encontrado." };

  const adapter = getAdapter(item.platform);
  if (!adapter) {
    await logAttempt({ userId, queueId, contentId: item.contentId, platform: item.platform, operation: "publish", status: "error", attempts: item.attempts + 1, errorCode: "VALIDATION", errorMessage: "Plataforma não suportada." });
    await markFailed(queueId, "VALIDATION", "Plataforma não suportada.", item.attempts + 1, false);
    return { ok: false, errorCode: "VALIDATION", errorMessage: "Plataforma não suportada." };
  }

  const payload = await buildPayload(userId, {
    id: item.contentId,
    platform: item.platform,
    format: item.format,
    draftId: item.contentId ? await getDraftId(userId, item.contentId) : null,
    copyId: null,
  });

  // Validação local antes de tocar o provider.
  const validation = adapter.validate(payload);
  if (!validation.valid) {
    const msg = validation.errors[0] ?? "Conteúdo inválido.";
    await logAttempt({ userId, queueId, contentId: item.contentId, platform: item.platform, operation: "publish", status: "error", attempts: item.attempts + 1, errorCode: "VALIDATION", errorMessage: msg });
    await markFailed(queueId, "VALIDATION", msg, item.attempts + 1, false);
    return { ok: false, errorCode: "VALIDATION", errorMessage: msg };
  }

  // Publica via adapter (pode retornar INTEGRATION_NOT_CONFIGURED).
  try {
    const result = await adapter.publish(payload);

    if (result.ok && result.externalId) {
      // Confirmação REAL do provider.
      await markPublished(queueId, result.externalId);
      await prisma.plannedContent.update({
        where: { id: item.contentId },
        data: { status: "PUBLICADO", publishedAt: result.publishedAt ? new Date(result.publishedAt) : new Date(), externalId: result.externalId },
      });
      await logAttempt({ userId, queueId, contentId: item.contentId, platform: item.platform, operation: "publish", status: "success", attempts: item.attempts + 1, externalId: result.externalId, provider: adapter.name });
      return { ok: true, status: "PUBLICADO", queueId, externalId: result.externalId };
    }

    // Falhou (ou não configurado).
    const code = result.errorCode ?? "RETRYABLE";
    const msg = result.errorMessage ?? friendlyMessage(code);
    const attempts = item.attempts + 1;
    const decision = decideRetry(code, attempts);

    await logAttempt({
      userId, queueId, contentId: item.contentId, platform: item.platform,
      operation: "publish", status: "error", attempts,
      errorCode: code, errorMessage: sanitizeMessage(msg), provider: adapter.name,
      externalId: result.externalId ?? null,
    });
    await markFailed(queueId, code, sanitizeMessage(msg), attempts, decision.shouldRetry, result.externalId);

    return { ok: false, status: "FALHOU", queueId, errorCode: code, errorMessage: msg };
  } catch (err) {
    const pe = toPublishError(err);
    const attempts = item.attempts + 1;
    const decision = decideRetry(pe.code, attempts);
    await logAttempt({
      userId, queueId, contentId: item.contentId, platform: item.platform,
      operation: "publish", status: "error", attempts,
      errorCode: pe.code, errorMessage: friendlyMessage(pe.code), provider: adapter.name,
    });
    await markFailed(queueId, pe.code, friendlyMessage(pe.code), attempts, decision.shouldRetry);
    return { ok: false, status: "FALHOU", queueId, errorCode: pe.code, errorMessage: friendlyMessage(pe.code) };
  }
}

/** Busca o draftId de um conteúdo (owner-check). */
async function getDraftId(userId: string, contentId: string): Promise<string | null> {
  const content = (await prisma.plannedContent.findUnique({
    where: { id: contentId },
  })) as unknown as { userId: string; draftId: string | null } | null;
  if (!content || content.userId !== userId) return null;
  return content.draftId;
}

export { MAX_AUTO_ATTEMPTS };
