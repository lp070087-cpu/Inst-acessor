import { randomUUID } from "node:crypto";
import { prisma, withDatabaseTransaction } from "@/lib/db";

/**
 * email-worker.ts promotes only HELD EMAIL VERIFY/WELCOME rows; campaign-worker.ts promotes only
 * rows of campaigns an admin confirmed (SENDING). Claim re-checks eligibility under the subscriber lock.
 */
export async function claimLaunchNotification(id: string) {
  return withDatabaseTransaction(async () => {
    const item = await prisma.launchNotification.findUnique({ where: { id } });
    if (!item || item.status !== "READY") return null;
    await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:launch'), hashtext(${`subscriber:${item.subscriberId}`}))::text`;
    const subscriber = await prisma.launchSubscriber.findUnique({ where: { id: item.subscriberId } });
    const eligible = subscriber && (item.kind === "VERIFY"
      ? subscriber.status === "PENDING" && !!subscriber.verificationExpiresAt && subscriber.verificationExpiresAt > new Date()
      : subscriber.status === "VERIFIED" && (item.channel === "EMAIL" ? subscriber.emailConsent : item.channel === "WHATSAPP" && subscriber.whatsappConsent));
    if (!eligible) {
      await prisma.launchNotification.updateMany({ where: { id, status: "READY" }, data: { status: "CANCELLED", privatePayload: null } });
      return null;
    }
    const leaseToken = randomUUID();
    const changed = await prisma.launchNotification.updateMany({ where: { id, status: "READY" }, data: {
      status: "PROCESSING", leaseToken, leaseUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 },
    } });
    return changed.count === 1 ? { id, leaseToken } : null;
  });
}

export type LaunchDeliveryResult = { status: "SENT"; providerId: string } | { status: "UNCERTAIN" | "CANCELLED"; errorCode?: string };
// Resend ids and WhatsApp message ids ("wamid." + base64, which may contain + / =).
const PROVIDER_ID = /^[a-zA-Z0-9_.:~+/=-]{1,200}$/;
/** A timeout is never a safe-to-retry failure. The provider ID is not a delivery claim. */
export async function finishLaunchNotification(id: string, leaseToken: string, result: LaunchDeliveryResult) {
  if (result.status === "SENT" && !PROVIDER_ID.test(result.providerId)) throw new Error("INVALID_PROVIDER_ID");
  const errorCode = result.status !== "SENT" ? result.errorCode : undefined;
  if (errorCode !== undefined && !/^[A-Z0-9_]{1,64}$/.test(errorCode)) throw new Error("INVALID_ERROR_CODE");
  const changed = await prisma.launchNotification.updateMany({ where: { id, status: "PROCESSING", leaseToken, leaseUntil: { gt: new Date() } }, data: {
    status: result.status, leaseToken: null, leaseUntil: null,
    providerId: result.status === "SENT" ? result.providerId : null,
    sentAt: result.status === "SENT" ? new Date() : null,
    privatePayload: null,
    ...(errorCode ? { errorCode } : {}),
  } });
  return changed.count === 1;
}

export async function recoverExpiredLaunchClaims() {
  return prisma.launchNotification.updateMany({ where: { status: "PROCESSING", leaseUntil: { lte: new Date() } }, data: {
    status: "UNCERTAIN", errorCode: "LEASE_EXPIRED_REVIEW_REQUIRED", leaseToken: null, leaseUntil: null,
  } });
}

/**
 * Returns a claimed row to HELD. Only for outcomes where the provider was never
 * reached or definitively refused the request: an ambiguous send must be UNCERTAIN.
 */
export async function releaseLaunchNotification(id: string, leaseToken: string, errorCode: string) {
  if (!/^[A-Z0-9_]{1,64}$/.test(errorCode)) throw new Error("INVALID_ERROR_CODE");
  const changed = await prisma.launchNotification.updateMany({ where: { id, status: "PROCESSING", leaseToken, leaseUntil: { gt: new Date() } }, data: {
    status: "HELD", leaseToken: null, leaseUntil: null, errorCode,
  } });
  return changed.count === 1;
}
