import { createHash, randomUUID } from "node:crypto";

export const TIKTOK_INBOX_LIMITS = { bodyBytes: 128 * 1024, leaseMs: 60_000, maxAttempts: 5 } as const;
export interface NormalizedTikTokEvent {
  eventKey: string;
  rawHash: string;
  eventName: string;
  occurredAt: Date;
  accountHash: string;
  reason: number | null;
  /** Ephemeral lookup value: never persisted or logged. */
  accountId: string;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Official envelope: developers.tiktok.com/docs/en/webhooks-events. Pure. */
export function normalizeTikTokEvent(raw: string, expectedClientKey: string, now = Date.now()): NormalizedTikTokEvent {
  if (!expectedClientKey || Buffer.byteLength(raw, "utf8") > TIKTOK_INBOX_LIMITS.bodyBytes) throw new Error("INVALID_ENVELOPE");
  const envelope: unknown = JSON.parse(raw);
  if (!object(envelope) || envelope.client_key !== expectedClientKey ||
      typeof envelope.event !== "string" || !/^[a-z][a-z0-9_.]{0,99}$/.test(envelope.event) ||
      typeof envelope.create_time !== "number" || !Number.isSafeInteger(envelope.create_time) ||
      envelope.create_time < 1 || envelope.create_time * 1000 > now + 5 * 60_000 ||
      typeof envelope.content !== "string" || envelope.content.length > TIKTOK_INBOX_LIMITS.bodyBytes ||
      (envelope.user_openid !== undefined && (typeof envelope.user_openid !== "string" || envelope.user_openid.length > 256))) {
    throw new Error("INVALID_ENVELOPE");
  }
  const content: unknown = JSON.parse(envelope.content);
  if (!object(content)) throw new Error("INVALID_CONTENT");
  const accountId = typeof envelope.user_openid === "string" ? envelope.user_openid : "";
  const accountHash = digest(`${expectedClientKey}\0${accountId}`);
  const reason = envelope.event === "authorization.removed" && Number.isInteger(content.reason) &&
    typeof content.reason === "number" && content.reason >= 0 && content.reason <= 5 ? content.reason : null;
  if (envelope.event === "authorization.removed" && (!accountId || reason === null)) throw new Error("INVALID_AUTHORIZATION_REMOVAL");
  const rawHash = digest(raw);
  // Unknown contracts remain quarantined; hash their unrecognized payload rather
  // than retaining it. Known removal events dedupe across JSON whitespace/order.
  const identity = envelope.event === "authorization.removed" ? reason : rawHash;
  return { eventKey: digest(JSON.stringify([digest(expectedClientKey), envelope.event, envelope.create_time, accountHash, identity])),
    rawHash, eventName: envelope.event, occurredAt: new Date(envelope.create_time * 1000), accountHash, reason, accountId };
}

/** Called only after signature, client-key and normalized-body validation. */
export async function ingestTikTokEvent(event: NormalizedTikTokEvent) {
  const { prisma } = await import("@/lib/db");
  const connections = event.accountId ? await prisma.socialConnection.findMany({
    where: { platform: "tiktok", externalAccountId: event.accountId }, select: { id: true, updatedAt: true }, take: 2,
  }) : [];
  const connection = connections.length === 1 ? connections[0] : null;
  const supported = event.eventName === "authorization.removed";
  const state = supported && connection ? "PENDING" : "QUARANTINED";
  const errorCode = !supported ? "UNSUPPORTED_EVENT" : !connection ? "UNKNOWN_OR_AMBIGUOUS_ACCOUNT" : null;
  // Atomic upsert does not reset state, attempts or an active claim on redelivery.
  return prisma.socialWebhookInbox.upsert({ where: { eventKey: event.eventKey }, update: {}, create: {
    eventKey: event.eventKey, rawHash: event.rawHash, eventName: event.eventName,
    occurredAt: event.occurredAt, accountHash: event.accountHash, reason: event.reason,
    connectionId: connection?.id ?? null, connectionVersion: connection?.updatedAt ?? null,
    state, errorCode,
  }, select: { id: true, state: true } });
}

/** Compare-and-swap claim. A reclaimed lease always receives a new fencing token. */
export async function claimTikTokEvent(id: string, now = new Date()): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const token = randomUUID();
  const changed = await prisma.socialWebhookInbox.updateMany({ where: { id, attempts: { lt: TIKTOK_INBOX_LIMITS.maxAttempts },
    OR: [{ state: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } }, { state: "PROCESSING", leaseUntil: { lt: now } }],
  }, data: { state: "PROCESSING", leaseToken: token, leaseUntil: new Date(now.getTime() + TIKTOK_INBOX_LIMITS.leaseMs), attempts: { increment: 1 } } });
  return changed.count === 1 ? token : null;
}

/** The claim guard and local effect commit together. No provider/API calls. */
export async function applyTikTokEvent(id: string, token: string): Promise<"PROCESSED" | "QUARANTINED" | "CONFLICT"> {
  const { prisma, withDatabaseTransaction } = await import("@/lib/db");
  return withDatabaseTransaction(async () => {
    const now = new Date();
    // This write holds the row lock until the local effect commits, excluding
    // both concurrent claims and expired-worker finalizers.
    const fence = await prisma.socialWebhookInbox.updateMany({ where: { id, state: "PROCESSING", leaseToken: token, leaseUntil: { gt: now } }, data: { updatedAt: now } });
    if (fence.count !== 1) return "CONFLICT";
    const event = await prisma.socialWebhookInbox.findUniqueOrThrow({ where: { id } });
    let errorCode: string | null = null;
    if (event.eventName !== "authorization.removed") errorCode = "UNSUPPORTED_EVENT";
    else if (!event.connectionId || !event.connectionVersion) errorCode = "UNKNOWN_OR_AMBIGUOUS_ACCOUNT";
    // A delayed deauthorization must not destroy a later reconnect/refresh.
    else if (event.connectionVersion > event.occurredAt) errorCode = "STALE_AUTHORIZATION_EVENT";
    else {
      const changed = await prisma.socialConnection.updateMany({ where: { id: event.connectionId, platform: "tiktok", updatedAt: event.connectionVersion },
        data: { status: "DISCONNECTED", tokenEncrypted: null, tokenExpiresAt: null, scopes: null, lastSyncErrorCode: "AUTHORIZATION_REMOVED" } });
      if (changed.count !== 1) errorCode = "CONNECTION_CHANGED";
    }
    const state = errorCode ? "QUARANTINED" : "PROCESSED";
    await prisma.socialWebhookInbox.update({ where: { id }, data: { state, errorCode, leaseToken: null, leaseUntil: null, processedAt: errorCode ? null : now } });
    return state;
  });
}

export async function failTikTokEvent(id: string, token: string) {
  const { prisma } = await import("@/lib/db");
  const event = await prisma.socialWebhookInbox.findUnique({ where: { id } });
  if (!event) return;
  const exhausted = event.attempts >= TIKTOK_INBOX_LIMITS.maxAttempts;
  await prisma.socialWebhookInbox.updateMany({ where: { id, state: "PROCESSING", leaseToken: token, leaseUntil: { gt: new Date() } },
    data: { state: exhausted ? "QUARANTINED" : "RETRY", errorCode: exhausted ? "RETRIES_EXHAUSTED" : "LOCAL_PROCESSING_FAILED",
      leaseToken: null, leaseUntil: null, nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** Math.min(event.attempts, 5)) } });
}

export async function processTikTokInbox(limit = 10) {
  if (process.env.SOCIAL_WEBHOOK_WORKER_ENABLED !== "true") return { enabled: false, processed: 0, quarantined: 0, failed: 0 };
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  await prisma.socialWebhookInbox.updateMany({ where: { state: "PROCESSING", leaseUntil: { lt: now }, attempts: { gte: TIKTOK_INBOX_LIMITS.maxAttempts } },
    data: { state: "QUARANTINED", errorCode: "LEASE_RETRIES_EXHAUSTED", leaseToken: null, leaseUntil: null } });
  const due = await prisma.socialWebhookInbox.findMany({ where: { attempts: { lt: TIKTOK_INBOX_LIMITS.maxAttempts },
    OR: [{ state: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } }, { state: "PROCESSING", leaseUntil: { lt: now } }],
  }, select: { id: true }, orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(25, Math.floor(limit) || 10)) });
  let processed = 0, quarantined = 0, failed = 0;
  for (const item of due) {
    const token = await claimTikTokEvent(item.id);
    if (!token) continue;
    try {
      const result = await applyTikTokEvent(item.id, token);
      if (result === "PROCESSED") processed++;
      if (result === "QUARANTINED") quarantined++;
    } catch {
      failed++;
      await failTikTokEvent(item.id, token);
    }
  }
  return { enabled: true, processed, quarantined, failed };
}
