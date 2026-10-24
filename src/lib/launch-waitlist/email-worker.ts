import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { getOfficialSiteUrl } from "@/lib/config/site";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email";
import { buildLaunchPrivateLinks } from "./delivery-contract";
import { claimLaunchNotification, finishLaunchNotification, recoverExpiredLaunchClaims, releaseLaunchNotification } from "./outbox";
import { launchTokenHash } from "./service";
import { renderLaunchMessage } from "./templates";

/**
 * TRANSACTIONAL LAUNCH EMAIL WORKER
 * =================================
 * Delivers ONLY channel EMAIL + kind VERIFY/WELCOME without a campaign.
 * LAUNCH campaigns (owner confirmation) and WHATSAPP (approved Meta templates)
 * are never selected, promoted or claimed here: they stay HELD.
 *
 * Double-send protection: claimLaunchNotification is a single-winner lease and
 * the notification idempotencyKey is sent as Resend's Idempotency-Key. Any
 * ambiguous provider outcome becomes UNCERTAIN and is never retried.
 * Never logs or returns personal data, links or tokens: counts only.
 */
export const LAUNCH_EMAIL_BATCH_MAX = 25;
export const LAUNCH_EMAIL_MAX_ATTEMPTS = 3;
const TIME_BUDGET_MS = 40_000;
const SYSTEMIC_REJECTIONS = new Set([401, 403, 429]);

export type LaunchEmailWorkerResult = {
  configured: boolean; recovered: number; promoted: number; claimed: number;
  sent: number; uncertain: number; released: number; cancelled: number; lost: number;
};

function transactionalEmailWhere(now: Date): Prisma.LaunchNotificationWhereInput {
  return {
    channel: "EMAIL", campaignId: null, attempts: { lt: LAUNCH_EMAIL_MAX_ATTEMPTS },
    OR: [
      { kind: "VERIFY", subscriber: { is: { status: "PENDING", verificationExpiresAt: { gt: now } } } },
      { kind: "WELCOME", subscriber: { is: { status: "VERIFIED", emailConsent: true } } },
    ],
  };
}

type Prepared = { to: string; subject: string; html: string; text: string; idempotencyKey: string } | { error: "STALE" | "PAYLOAD_UNAVAILABLE" | "RENDER_FAILED" };

async function prepare(notificationId: string): Promise<Prepared> {
  const row = await prisma.launchNotification.findUnique({ where: { id: notificationId }, include: { subscriber: true } });
  if (!row || row.status !== "PROCESSING" || row.channel !== "EMAIL" || row.campaignId || !["VERIFY", "WELCOME"].includes(row.kind)) return { error: "STALE" };
  const subscriber = row.subscriber;
  const origin = getOfficialSiteUrl();
  let confirmationUrl: string | undefined, unsubscribeUrl: string;
  try {
    if (row.kind === "VERIFY") {
      if (!row.privatePayload) return { error: "PAYLOAD_UNAVAILABLE" };
      const payload: unknown = JSON.parse(decryptToken(row.privatePayload));
      const { token, unsubscribeToken } = (payload ?? {}) as { token?: unknown; unsubscribeToken?: unknown };
      if (typeof token !== "string" || typeof unsubscribeToken !== "string") return { error: "PAYLOAD_UNAVAILABLE" };
      // A superseded verification token must never be delivered.
      if (subscriber.verificationHash !== launchTokenHash(token)) return { error: "STALE" };
      if (subscriber.unsubscribeHash !== launchTokenHash(unsubscribeToken)) return { error: "PAYLOAD_UNAVAILABLE" };
      ({ confirmationUrl, unsubscribeUrl } = buildLaunchPrivateLinks(origin, token, unsubscribeToken));
    } else {
      const unsubscribeToken = decryptToken(subscriber.unsubscribeSecret);
      if (subscriber.unsubscribeHash !== launchTokenHash(unsubscribeToken)) return { error: "PAYLOAD_UNAVAILABLE" };
      // Same validated builder; the confirmation link is discarded because WELCOME has none.
      ({ unsubscribeUrl } = buildLaunchPrivateLinks(origin, unsubscribeToken, unsubscribeToken));
    }
  } catch {
    return { error: "PAYLOAD_UNAVAILABLE" };
  }
  try {
    const message = renderLaunchMessage({ kind: row.kind as "VERIFY" | "WELCOME", name: subscriber.name, planSlug: subscriber.planSlug, unsubscribeUrl, confirmationUrl });
    return { to: subscriber.email, ...message, idempotencyKey: row.idempotencyKey };
  } catch {
    return { error: "RENDER_FAILED" };
  }
}

export async function processLaunchEmails(limit = LAUNCH_EMAIL_BATCH_MAX): Promise<LaunchEmailWorkerResult> {
  const result: LaunchEmailWorkerResult = { configured: false, recovered: 0, promoted: 0, claimed: 0, sent: 0, uncertain: 0, released: 0, cancelled: 0, lost: 0 };
  const startedAt = Date.now();
  result.recovered = (await recoverExpiredLaunchClaims()).count;
  // Not configured: do nothing at all, rows remain HELD.
  if (!isTransactionalEmailConfigured()) return result;
  result.configured = true;

  const take = Math.max(1, Math.min(LAUNCH_EMAIL_BATCH_MAX, Math.floor(limit)));
  const now = new Date();
  const candidates = await prisma.launchNotification.findMany({
    where: { ...transactionalEmailWhere(now), status: { in: ["HELD", "READY"] } },
    orderBy: { createdAt: "asc" }, take, select: { id: true },
  });
  const ids = candidates.map(item => item.id);
  if (!ids.length) return result;
  // Promotion re-applies the full filter so a row changed meanwhile is not activated.
  result.promoted = (await prisma.launchNotification.updateMany({
    where: { ...transactionalEmailWhere(now), id: { in: ids }, status: "HELD" }, data: { status: "READY" },
  })).count;

  let stoppedEarly = false;
  for (const id of ids) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { stoppedEarly = true; break; }
    // Re-checks subscriber eligibility under the subscriber lock; a concurrent worker loses here.
    const claim = await claimLaunchNotification(id);
    if (!claim) continue;
    result.claimed++;
    const prepared = await prepare(id);
    if ("error" in prepared) {
      if (prepared.error === "STALE") {
        if (await finishLaunchNotification(id, claim.leaseToken, { status: "CANCELLED" })) result.cancelled++;
      } else if (await releaseLaunchNotification(id, claim.leaseToken, prepared.error)) result.released++;
      continue;
    }
    let outcome: Awaited<ReturnType<typeof sendTransactionalEmail>>;
    try { outcome = await sendTransactionalEmail(prepared); }
    catch { outcome = { status: "UNCERTAIN", reason: "NETWORK" }; }

    if (outcome.status === "SENT") {
      if (await finishLaunchNotification(id, claim.leaseToken, { status: "SENT", providerId: outcome.providerId })) result.sent++;
      else result.lost++; // lease lost (e.g. unsubscribed meanwhile): row already UNCERTAIN, never resent.
    } else if (outcome.status === "UNCERTAIN") {
      if (await finishLaunchNotification(id, claim.leaseToken, { status: "UNCERTAIN" })) result.uncertain++;
      else result.lost++;
      await prisma.launchNotification.updateMany({ where: { id, status: "UNCERTAIN", errorCode: null }, data: { errorCode: `PROVIDER_${outcome.reason}` } });
    } else {
      const code = outcome.status === "NOT_CONFIGURED" ? "PROVIDER_NOT_CONFIGURED" : `PROVIDER_REJECTED_${outcome.httpStatus}`;
      if (await releaseLaunchNotification(id, claim.leaseToken, code)) result.released++;
      // Configuration, credentials or rate limit: further sends in this batch would fail the same way.
      if (outcome.status === "NOT_CONFIGURED" || SYSTEMIC_REJECTIONS.has(outcome.httpStatus)) { stoppedEarly = true; break; }
    }
  }
  // Rows promoted but left unclaimed by an early stop go back to HELD (eligible next run).
  if (stoppedEarly) await prisma.launchNotification.updateMany({ where: { id: { in: ids }, status: "READY" }, data: { status: "HELD" } });
  return result;
}
