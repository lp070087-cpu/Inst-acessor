/**
 * PUBLISHING — Fase 7 (barrel público)
 * ====================================
 * Motor central de publicação:
 *   service      — publishContent / scheduleContent / cancelScheduledContent /
 *                  retryPublication / getPublicationStatus / processQueue.
 *   queue        — fila em banco (Parte 4).
 *   retry        — retry controlado (Parte 5).
 *   status       — estados reais (Parte 3).
 *   compatibility— camada de compatibilidade (Parte 8).
 *   adapters     — Instagram/TikTok (Partes 6 e 7).
 *   errors       — erros classificados (Parte 5).
 *
 * Backward-compat preservado:
 *   prepareInstagramPublish / prepareTikTokPublish / validatePublishPayload /
 *   getPublisher / PUBLISH_PLATFORMS / PublishPlatform.
 */

export { getAdapter, listAdapters } from "./adapters";
import { getAdapter } from "./adapters";
import type { PublishPayload } from "./types";
export {
  publishContent,
  scheduleContent,
  cancelScheduledContent,
  retryPublication,
  getPublicationStatus,
  processQueue,
  processQueueItem,
  MAX_AUTO_ATTEMPTS,
} from "./service";
export type {
  PublishContentInput,
  PublishContentResult,
  ScheduleContentInput,
  RetryPublicationInput,
  ProcessQueueResult,
} from "./service";

export {
  enqueuePublication,
  listQueue,
  getQueueItem,
  cancelQueueItem,
  markProcessing,
  markPublished,
  markFailed,
} from "./queue";
export type { EnqueueInput, EnqueueResult, QueueItemView } from "./queue";

export { decideRetry, logAttempt } from "./retry";
export type { RetryDecision } from "./retry";

export {
  CONTENT_STATUSES_FASE7,
  PUBLISHING_STATUSES,
  STATUS_LABELS_FASE7,
  STATUS_TONES_FASE7,
} from "./status";
export type { ContentStatusFase7 } from "./status";

export {
  isFormatAvailable,
  getAvailableFormats,
  isPhotoFormatOnTikTok,
  PLATFORM_FORMATS,
  FORMAT_LABELS,
  PLATFORM_LABELS,
  PLATFORM_MIME_TYPES,
  PLATFORM_MEDIA_LIMITS,
  expectedMediaType,
  checkCompatibility,
  compatibilityErrors,
  isCompatible,
} from "./compatibility";
export type {
  CompatibilityIssue,
  CompatibilityInput,
  MediaLimits,
} from "./compatibility";

export {
  PUBLISH_PLATFORMS,
  PUBLISH_FORMATS,
  QUEUE_STATUSES,
  PUBLISH_ERROR_CODES,
} from "./types";
export type {
  PublishPlatform,
  PublishFormat,
  QueueStatus,
  PublishErrorCode,
  PublishPayload,
  PublishResult,
  PublishValidationResult,
  PublishStatusQuery,
  PublishStatusResult,
  PublishCancelQuery,
  PublishCancelResult,
  PublishingAdapter,
} from "./types";

export {
  PublishError,
  publishError,
  toPublishError,
  isRetryableCode,
  isUserActionCode,
  sanitizeMessage,
  friendlyMessage,
} from "./errors";

// Backward-compat (Fase 6 — preparação).
export { prepareInstagramPublish, instagramAdapter, buildInstagramPayload } from "./instagram";
export { prepareTikTokPublish, tiktokAdapter } from "./tiktok";

// Publicação real — módulos puros e infra.
export { PublishHttpError, publishHttp } from "./http";
export {
  isPublicMediaUrl,
  isDataUrl,
  extractMediaRefs,
  trimToLimit,
  buildCaption,
  instagramContainerKind,
  buildInstagramContainers,
  buildTikTokPostBody,
  mapTikTokStatus,
  mapInstagramStatus,
  isVideoMime,
  INSTAGRAM_CAPTION_LIMIT,
  TIKTOK_DESC_LIMIT,
} from "./media";
export { resolvePublishConnection } from "./connection";
export type { PublishConnection, ConnectionResolution } from "./connection";

export type { PublishPayload as LegacyPublishPayload, PublishResult as LegacyPublishResult } from "./types";

/** Retorna o adapter preparado para a plataforma, ou null se não suportada. */
export function getPublisher(platform: string) {
  const adapter = getAdapter(platform);
  if (!adapter) return null;
  return { prepare: (payload: PublishPayload) => adapter.validate(payload), platform };
}
