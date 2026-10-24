import { randomUUID } from "node:crypto";
import { prisma, withDatabaseTransaction } from "@/lib/db";

/** No caller promotes HELD rows: activation requires a separately reviewed worker. */
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

export type LaunchDeliveryResult = { status: "SENT"; providerId: string } | { status: "UNCERTAIN" | "CANCELLED" };
/** A timeout is never a safe-to-retry failure. The provider ID is not a delivery claim. */
export async function finishLaunchNotification(id: string, leaseToken: string, result: LaunchDeliveryResult) {
  if (result.status === "SENT" && !/^[a-zA-Z0-9_.:~-]{1,200}$/.test(result.providerId)) throw new Error("INVALID_PROVIDER_ID");
  const changed = await prisma.launchNotification.updateMany({ where: { id, status: "PROCESSING", leaseToken, leaseUntil: { gt: new Date() } }, data: {
    status: result.status, leaseToken: null, leaseUntil: null,
    providerId: result.status === "SENT" ? result.providerId : null,
    sentAt: result.status === "SENT" ? new Date() : null,
    privatePayload: null,
  } });
  return changed.count === 1;
}

export async function recoverExpiredLaunchClaims() {
  return prisma.launchNotification.updateMany({ where: { status: "PROCESSING", leaseUntil: { lte: new Date() } }, data: {
    status: "UNCERTAIN", errorCode: "LEASE_EXPIRED_REVIEW_REQUIRED", leaseToken: null, leaseUntil: null,
  } });
}
