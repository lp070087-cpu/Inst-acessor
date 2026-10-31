import { prisma, withDatabaseTransaction } from "@/lib/db";
import { CONSENT_VERSION } from "./validation";
import { launchTokenHash } from "./service";

/**
 * Public preferences, authorised only by the private unsubscribe capability
 * (64-hex token kept in the URL fragment). Responses never include name, email
 * or phone. UNSUBSCRIBED is terminal here: re-enabling would resurrect a
 * registration the person explicitly ended.
 */
export type LaunchPreferences = { status: "PENDING" | "VERIFIED" | "UNSUBSCRIBED"; emailConsent: boolean; whatsappConsent: boolean };

const valid = (token: string) => /^[a-f0-9]{64}$/.test(token);

export async function readLaunchPreferences(token: string): Promise<LaunchPreferences | null> {
  if (!valid(token)) return null;
  const row = await prisma.launchSubscriber.findUnique({ where: { unsubscribeHash: launchTokenHash(token) }, select: { status: true, emailConsent: true, whatsappConsent: true } });
  if (!row) return null;
  return { status: row.status as LaunchPreferences["status"], emailConsent: row.emailConsent, whatsappConsent: row.whatsappConsent };
}

export async function updateLaunchPreferences(token: string, next: { emailConsent: boolean; whatsappConsent: boolean }): Promise<LaunchPreferences | null> {
  if (!valid(token)) return null;
  return withDatabaseTransaction(async () => {
    const found = await prisma.launchSubscriber.findUnique({ where: { unsubscribeHash: launchTokenHash(token) }, select: { id: true } });
    if (!found) return null;
    await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:launch'), hashtext(${`subscriber:${found.id}`}))::text`;
    const row = await prisma.launchSubscriber.findUnique({ where: { id: found.id } });
    if (!row) return null;
    const current: LaunchPreferences = { status: row.status as LaunchPreferences["status"], emailConsent: row.emailConsent, whatsappConsent: row.whatsappConsent };
    if (row.status === "UNSUBSCRIBED") return current;
    const changes = (["EMAIL", "WHATSAPP"] as const).filter(channel => channel === "EMAIL" ? row.emailConsent !== next.emailConsent : row.whatsappConsent !== next.whatsappConsent);
    if (!changes.length) return current;
    await prisma.launchSubscriber.update({ where: { id: row.id }, data: { emailConsent: next.emailConsent, whatsappConsent: next.whatsappConsent } });
    await prisma.launchConsent.createMany({ data: changes.map(channel => ({
      subscriberId: row.id, channel, granted: channel === "EMAIL" ? next.emailConsent : next.whatsappConsent, version: CONSENT_VERSION, source: "preferences",
    })) });
    const revoked = changes.filter(channel => !(channel === "EMAIL" ? next.emailConsent : next.whatsappConsent));
    if (revoked.length) {
      // Marketing/campaign messages of a revoked channel are never sent. The transactional
      // VERIFY email stays: it is the confirmation the person requested.
      await prisma.launchNotification.updateMany({ where: { subscriberId: row.id, channel: { in: revoked }, kind: { not: "VERIFY" }, status: { in: ["HELD", "READY"] } }, data: {
        status: "CANCELLED", privatePayload: null, errorCode: "CONSENT_REVOKED",
      } });
      await prisma.launchNotification.updateMany({ where: { subscriberId: row.id, channel: { in: revoked }, kind: { not: "VERIFY" }, status: "PROCESSING" }, data: {
        status: "UNCERTAIN", errorCode: "CONSENT_REVOKED_DURING_CLAIM", leaseToken: null, leaseUntil: null,
      } });
    }
    return { status: current.status, emailConsent: next.emailConsent, whatsappConsent: next.whatsappConsent };
  });
}
