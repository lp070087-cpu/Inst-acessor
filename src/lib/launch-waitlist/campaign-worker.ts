import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { getOfficialSiteUrl } from "@/lib/config/site";
import { sendTransactionalEmail } from "@/lib/email";
import { sendWhatsAppTemplate, whatsAppTemplateFor } from "@/lib/whatsapp/cloud-api";
import { buildLaunchPrivateLinks } from "./delivery-contract";
import { claimLaunchNotification, finishLaunchNotification, recoverExpiredLaunchClaims, releaseLaunchNotification } from "./outbox";
import { launchTokenHash } from "./service";
import { renderLaunchMessage } from "./templates";
import { LAUNCH_CAMPAIGN_MAX_ATTEMPTS, decodeCampaignPayload, eligibleSubscriberFilter, isCampaignTransportReady } from "./campaigns";

/**
 * CAMPAIGN DELIVERY WORKER (NEWS / LAUNCH, EMAIL or WHATSAPP)
 * ==========================================================
 * Only rows of campaigns in status SENDING (set exclusively by the admin's typed
 * confirmation) are ever promoted HELD → READY, claimed and sent. Never VERIFY/WELCOME,
 * so WhatsApp never sends anything automatically.
 *
 * Guarantees (same pattern as email-worker.ts):
 *   - transport not configured → returns immediately; rows stay HELD;
 *   - eligibility re-checked at promotion and under the subscriber lock at claim
 *     (VERIFIED + channel consent at send time); ineligible rows → CANCELLED;
 *   - single-winner lease; idempotency key = LaunchNotification.idempotencyKey
 *     (Resend Idempotency-Key; WhatsApp relies on the lease + unique key);
 *   - timeout / unknown outcome → UNCERTAIN, never retried automatically;
 *   - rate limit or systemic refusal stops the batch; unclaimed rows go back to HELD;
 *   - paced sends (intervalMs) and a time budget per run.
 * Results carry counts only — no personal data, links or tokens.
 */
export type LaunchCampaignChannel = "EMAIL" | "WHATSAPP";
export const LAUNCH_CAMPAIGN_BATCH_MAX = 100;
const DEFAULT_LIMIT = 50;
// Resend's default limit is 2 requests/second per team; WhatsApp Cloud API allows far more.
const DEFAULT_INTERVAL_MS: Record<LaunchCampaignChannel, number> = { EMAIL: 550, WHATSAPP: 120 };
const DEFAULT_BUDGET_MS = 40_000;
const EMAIL_SYSTEMIC = new Set([0, 401, 403, 429]);

export type LaunchCampaignWorkerResult = {
  channel: LaunchCampaignChannel; configured: boolean; campaigns: number; recovered: number; cancelled: number; promoted: number;
  claimed: number; sent: number; uncertain: number; released: number; lost: number; completed: number; stopped: string | null;
};

type Outcome =
  | { kind: "SENT"; providerId: string }
  | { kind: "UNCERTAIN"; code: string }
  | { kind: "RELEASE"; code: string; stop: boolean; refundAttempt?: boolean }
  | { kind: "CANCEL"; code: string; stop: boolean };

function eligibleRowWhere(channel: LaunchCampaignChannel, campaignIds: string[], kinds: string[]): Prisma.LaunchNotificationWhereInput {
  return {
    campaignId: { in: campaignIds }, channel, kind: { in: kinds }, attempts: { lt: LAUNCH_CAMPAIGN_MAX_ATTEMPTS },
    campaign: { is: { status: "SENDING", channel } },
    subscriber: { is: eligibleSubscriberFilter(channel) },
  };
}

async function loadClaimed(id: string, channel: LaunchCampaignChannel) {
  const row = await prisma.launchNotification.findUnique({ where: { id }, include: { subscriber: true, campaign: true } });
  if (!row || row.status !== "PROCESSING" || row.channel !== channel || !row.campaign || row.campaign.status !== "SENDING" ||
    row.campaign.channel !== channel || !["NEWS", "LAUNCH"].includes(row.kind)) return null;
  return row;
}

async function deliverEmail(id: string): Promise<Outcome> {
  const row = await loadClaimed(id, "EMAIL");
  if (!row) return { kind: "CANCEL", code: "STALE", stop: false };
  const content = decodeCampaignPayload(row.privatePayload);
  if (!content || (content.kind && content.kind !== row.kind)) return { kind: "RELEASE", code: "PAYLOAD_UNAVAILABLE", stop: false };
  let links: ReturnType<typeof buildLaunchPrivateLinks>;
  try {
    const unsubscribeToken = decryptToken(row.subscriber.unsubscribeSecret);
    if (row.subscriber.unsubscribeHash !== launchTokenHash(unsubscribeToken)) return { kind: "RELEASE", code: "PAYLOAD_UNAVAILABLE", stop: false };
    links = buildLaunchPrivateLinks(getOfficialSiteUrl(), unsubscribeToken, unsubscribeToken);
  } catch { return { kind: "RELEASE", code: "PAYLOAD_UNAVAILABLE", stop: false }; }
  let message: ReturnType<typeof renderLaunchMessage>;
  try {
    message = renderLaunchMessage({
      kind: row.kind as "NEWS" | "LAUNCH", name: row.subscriber.name, planSlug: row.subscriber.planSlug,
      unsubscribeUrl: links.unsubscribeUrl, preferencesUrl: links.preferencesUrl,
      // LAUNCH: the campaign reached SENDING only through the admin's explicit presale approval.
      saleUrl: content.saleUrl, presaleApproved: row.kind === "LAUNCH",
      newsSubject: content.subject, newsBody: content.body, newsCtaUrl: content.ctaUrl,
    });
  } catch { return { kind: "RELEASE", code: "RENDER_FAILED", stop: false }; }
  let outcome: Awaited<ReturnType<typeof sendTransactionalEmail>>;
  try { outcome = await sendTransactionalEmail({ to: row.subscriber.email, ...message, idempotencyKey: row.idempotencyKey }); }
  catch { outcome = { status: "UNCERTAIN", reason: "NETWORK" }; }
  switch (outcome.status) {
    case "SENT": return { kind: "SENT", providerId: outcome.providerId };
    case "UNCERTAIN": return { kind: "UNCERTAIN", code: `PROVIDER_${outcome.reason}` };
    case "NOT_CONFIGURED": return { kind: "RELEASE", code: "PROVIDER_NOT_CONFIGURED", stop: true, refundAttempt: true };
    default: return { kind: "RELEASE", code: `PROVIDER_REJECTED_${outcome.httpStatus}`, stop: EMAIL_SYSTEMIC.has(outcome.httpStatus), refundAttempt: outcome.httpStatus === 429 };
  }
}

async function deliverWhatsApp(id: string): Promise<Outcome> {
  const row = await loadClaimed(id, "WHATSAPP");
  if (!row) return { kind: "CANCEL", code: "STALE", stop: false };
  const outcome = await sendWhatsAppTemplate({ recipientE164: row.subscriber.whatsapp, kind: row.kind as "NEWS" | "LAUNCH", firstName: row.subscriber.name });
  switch (outcome.status) {
    case "SENT": return { kind: "SENT", providerId: outcome.providerId };
    case "UNCERTAIN": return { kind: "UNCERTAIN", code: `WA_${outcome.reason}` };
    case "NOT_CONFIGURED": return { kind: "RELEASE", code: "WA_NOT_CONFIGURED", stop: true, refundAttempt: true };
    case "RATE_LIMITED": return { kind: "RELEASE", code: `WA_RATE_LIMITED_${outcome.code}`, stop: true, refundAttempt: true };
    // Template problems affect every recipient: cancel this row (recorded) and stop for admin review.
    case "TEMPLATE_ERROR": return { kind: "CANCEL", code: `WA_TEMPLATE_${outcome.code}`, stop: true };
    case "RECIPIENT_ERROR": return { kind: "CANCEL", code: `WA_RECIPIENT_${outcome.code}`, stop: false };
    default: return { kind: "RELEASE", code: `WA_REJECTED_${outcome.code}`, stop: true };
  }
}

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

export async function processLaunchCampaignMessages(channel: LaunchCampaignChannel, options: {
  limit?: number; intervalMs?: number; deadline?: number; campaignId?: string;
} = {}): Promise<LaunchCampaignWorkerResult> {
  const result: LaunchCampaignWorkerResult = { channel, configured: false, campaigns: 0, recovered: 0, cancelled: 0, promoted: 0, claimed: 0, sent: 0, uncertain: 0, released: 0, lost: 0, completed: 0, stopped: null };
  const deadline = options.deadline ?? Date.now() + DEFAULT_BUDGET_MS;
  const interval = Math.max(0, Math.min(5_000, options.intervalMs ?? DEFAULT_INTERVAL_MS[channel]));
  result.recovered = (await recoverExpiredLaunchClaims()).count;
  // Not configured (flag, credentials or sender): nothing at all; rows stay HELD.
  if (!isCampaignTransportReady(channel)) return result;
  result.configured = true;
  const kinds = channel === "EMAIL" ? ["NEWS", "LAUNCH"] : (["NEWS", "LAUNCH"] as const).filter(kind => whatsAppTemplateFor(kind));
  const campaigns = await prisma.launchCampaign.findMany({
    where: { status: "SENDING", channel, ...(options.campaignId ? { id: options.campaignId } : {}) }, select: { id: true }, orderBy: { createdAt: "asc" },
  });
  const campaignIds = campaigns.map(item => item.id);
  result.campaigns = campaignIds.length;
  if (!campaignIds.length) return result;

  // Consent withdrawn or unsubscribed after the snapshot: never sent.
  result.cancelled += (await prisma.launchNotification.updateMany({
    where: { campaignId: { in: campaignIds }, status: { in: ["HELD", "READY"] }, NOT: { subscriber: { is: eligibleSubscriberFilter(channel) } } },
    data: { status: "CANCELLED", privatePayload: null, errorCode: "INELIGIBLE_AT_SEND" },
  })).count;

  if (kinds.length) {
    const take = Math.max(1, Math.min(LAUNCH_CAMPAIGN_BATCH_MAX, Math.floor(options.limit ?? DEFAULT_LIMIT)));
    const where = eligibleRowWhere(channel, campaignIds, [...kinds]);
    const ids = (await prisma.launchNotification.findMany({ where: { ...where, status: { in: ["HELD", "READY"] } }, orderBy: { createdAt: "asc" }, take, select: { id: true } })).map(item => item.id);
    if (ids.length) {
      result.promoted = (await prisma.launchNotification.updateMany({ where: { ...where, id: { in: ids }, status: "HELD" }, data: { status: "READY" } })).count;
      let attempted = false;
      for (const id of ids) {
        // Pacing happens before the claim so a lease is never held while waiting.
        if (attempted && interval) await sleep(interval);
        if (Date.now() >= deadline) { result.stopped = "TIME_BUDGET"; break; }
        const claim = await claimLaunchNotification(id);
        if (!claim) continue;
        result.claimed++;
        attempted = true;
        const outcome = await (channel === "EMAIL" ? deliverEmail(id) : deliverWhatsApp(id));
        if (outcome.kind === "SENT") {
          if (await finishLaunchNotification(id, claim.leaseToken, { status: "SENT", providerId: outcome.providerId })) result.sent++;
          else result.lost++; // lease lost (e.g. unsubscribed meanwhile): row is UNCERTAIN, never resent.
        } else if (outcome.kind === "UNCERTAIN") {
          if (await finishLaunchNotification(id, claim.leaseToken, { status: "UNCERTAIN", errorCode: outcome.code })) result.uncertain++;
          else result.lost++;
        } else if (outcome.kind === "CANCEL") {
          if (await finishLaunchNotification(id, claim.leaseToken, { status: "CANCELLED", ...(outcome.code === "STALE" ? {} : { errorCode: outcome.code }) })) result.cancelled++;
          if (outcome.stop) { result.stopped = outcome.code; break; }
        } else {
          if (await releaseLaunchNotification(id, claim.leaseToken, outcome.code)) {
            result.released++;
            // Nothing was sent (quota/configuration): do not consume the attempt budget.
            if (outcome.refundAttempt) await prisma.launchNotification.updateMany({ where: { id, status: "HELD", attempts: { gt: 0 } }, data: { attempts: { decrement: 1 } } });
          }
          if (outcome.stop) { result.stopped = outcome.code; break; }
        }
      }
      if (result.stopped) await prisma.launchNotification.updateMany({ where: { id: { in: ids }, status: "READY" }, data: { status: "HELD" } });
    }
  }

  for (const campaignId of campaignIds) {
    const remaining = await prisma.launchNotification.count({ where: { campaignId, OR: [
      { status: { in: ["READY", "PROCESSING"] } }, { status: "HELD", attempts: { lt: LAUNCH_CAMPAIGN_MAX_ATTEMPTS } },
    ] } });
    if (!remaining) result.completed += (await prisma.launchCampaign.updateMany({ where: { id: campaignId, status: "SENDING" }, data: { status: "COMPLETED" } })).count;
  }
  return result;
}
