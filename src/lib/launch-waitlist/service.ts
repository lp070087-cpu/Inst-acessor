import { createHash, randomBytes } from "node:crypto";
import { prisma, withDatabaseTransaction } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { CONSENT_VERSION, type LaunchSignup } from "./validation";

export const launchTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const LAUNCH_TOKEN_TTL_MS = 24 * 60 * 60_000;
async function lock(key: string) {
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:launch'), hashtext(${key}))::text`;
}

/** Duplicate emails OR phones never overwrite an existing person's identity/consent. */
export async function registerLaunchSubscriber(input: LaunchSignup): Promise<void> {
  if (input.website) return;
  const token = randomBytes(32).toString("hex");
  const unsubscribeToken = randomBytes(32).toString("hex");
  // Validate encryption configuration before duplicate lookup too: failures must not enumerate contacts.
  const privatePayload = encryptToken(JSON.stringify({ token, unsubscribeToken, consentVersion: CONSENT_VERSION }));
  const unsubscribeSecret = encryptToken(unsubscribeToken);
  await withDatabaseTransaction(async () => {
    for (const key of [`email:${input.email}`, `phone:${input.whatsapp}`].sort()) await lock(key);
    const exists = await prisma.launchSubscriber.findFirst({ where: { OR: [{ email: input.email }, { whatsapp: input.whatsapp }] } });
    if (exists) {
      // Reissue is not an identity/consent update: both original identifiers must match.
      if (exists.email !== input.email || exists.whatsapp !== input.whatsapp) return;
      await lock(`subscriber:${exists.id}`);
      const current = await prisma.launchSubscriber.findUnique({ where: { id: exists.id } });
      if (!current || current.status !== "PENDING" || !current.verificationExpiresAt || current.verificationExpiresAt > new Date()) return;
      const replacementPayload = encryptToken(JSON.stringify({ token, unsubscribeToken: decryptToken(current.unsubscribeSecret), consentVersion: CONSENT_VERSION }));
      await prisma.launchSubscriber.update({ where: { id: current.id }, data: {
        verificationHash: launchTokenHash(token), verificationExpiresAt: new Date(Date.now() + LAUNCH_TOKEN_TTL_MS),
      } });
      await prisma.launchNotification.updateMany({ where: { subscriberId: current.id, kind: "VERIFY", status: { in: ["HELD", "READY"] } }, data: { status: "CANCELLED", privatePayload: null } });
      await prisma.launchNotification.updateMany({ where: { subscriberId: current.id, kind: "VERIFY", status: "PROCESSING" }, data: {
        status: "UNCERTAIN", errorCode: "VERIFICATION_REISSUED", leaseToken: null, leaseUntil: null, privatePayload: null,
      } });
      await prisma.launchNotification.create({ data: { subscriberId: current.id, kind: "VERIFY", channel: "EMAIL", status: "HELD",
        idempotencyKey: `verify:${current.id}:${launchTokenHash(token)}`, privatePayload: replacementPayload } });
      return;
    }
    const subscriber = await prisma.launchSubscriber.create({ data: {
      name: input.name, email: input.email, whatsapp: input.whatsapp, planSlug: input.planSlug, source: input.source,
      emailConsent: input.emailConsent, whatsappConsent: input.whatsappConsent,
      verificationHash: launchTokenHash(token), verificationExpiresAt: new Date(Date.now() + LAUNCH_TOKEN_TTL_MS),
      unsubscribeHash: launchTokenHash(unsubscribeToken),
      unsubscribeSecret,
    } });
    await prisma.launchConsent.createMany({ data: ["EMAIL", "WHATSAPP"].map((channel) => ({ subscriberId: subscriber.id, channel,
      granted: channel === "EMAIL" ? input.emailConsent : input.whatsappConsent, version: CONSENT_VERSION, source: input.source })) });
    await prisma.launchNotification.create({ data: { subscriberId: subscriber.id, kind: "VERIFY", channel: "EMAIL",
      idempotencyKey: `verify:${subscriber.id}`, privatePayload, status: "HELD" } });
  });
}

export async function confirmLaunchSubscription(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return withDatabaseTransaction(async () => {
    const row = await prisma.launchSubscriber.findUnique({ where: { verificationHash: launchTokenHash(token) } });
    if (!row) return false;
    await lock(`subscriber:${row.id}`);
    const result = await prisma.launchSubscriber.updateMany({ where: { id: row.id, status: "PENDING", verificationHash: launchTokenHash(token), verificationExpiresAt: { gt: new Date() } },
      data: { status: "VERIFIED", verifiedAt: new Date(), verificationHash: null, verificationExpiresAt: null } });
    if (result.count !== 1) return false;
    await prisma.launchNotification.updateMany({ where: { subscriberId: row.id, kind: "VERIFY", status: { in: ["HELD", "READY"] } }, data: { status: "CANCELLED", privatePayload: null } });
    const welcomeChannels = (["EMAIL", "WHATSAPP"] as const).filter((channel) => channel === "EMAIL" ? row.emailConsent : row.whatsappConsent);
    if (welcomeChannels.length) await prisma.launchNotification.createMany({ data: welcomeChannels.map((channel) => ({
      subscriberId: row.id, kind: "WELCOME", channel, status: "HELD", idempotencyKey: `welcome:${row.id}:${channel}`,
    })), skipDuplicates: true });
    return true;
  });
}

export async function unsubscribeLaunchSubscriber(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return withDatabaseTransaction(async () => {
    const row = await prisma.launchSubscriber.findUnique({ where: { unsubscribeHash: launchTokenHash(token) } });
    if (!row) return false;
    await lock(`subscriber:${row.id}`);
    const changed = await prisma.launchSubscriber.updateMany({ where: { id: row.id, status: { not: "UNSUBSCRIBED" } }, data: {
      status: "UNSUBSCRIBED", emailConsent: false, whatsappConsent: false, unsubscribedAt: new Date(), verificationHash: null, verificationExpiresAt: null,
    } });
    if (changed.count) await prisma.launchConsent.createMany({ data: ["EMAIL", "WHATSAPP"].map((channel) => ({ subscriberId: row.id, channel, granted: false, version: CONSENT_VERSION, source: "unsubscribe" })) });
    await prisma.launchNotification.updateMany({ where: { subscriberId: row.id, status: { in: ["HELD", "READY"] } }, data: { status: "CANCELLED", privatePayload: null } });
    // A claimed request might already have reached a provider: never blindly retry it.
    await prisma.launchNotification.updateMany({ where: { subscriberId: row.id, status: "PROCESSING" }, data: { status: "UNCERTAIN", errorCode: "UNSUBSCRIBED_DURING_CLAIM", leaseToken: null, leaseUntil: null } });
    return true;
  });
}

/** Prepare only; intentionally no transport, scheduler, or transition to READY. */
export async function prepareLaunchCampaign(input: { key: string; channel: "EMAIL" | "WHATSAPP" }) {
  return withDatabaseTransaction(async () => {
    await lock(`campaign:${input.key}`);
    const existing = await prisma.launchCampaign.findUnique({ where: { key: input.key } });
    if (existing) {
      if (existing.channel !== input.channel) throw new Error("CAMPAIGN_CONFLICT");
      return { campaignId: existing.id, queued: await prisma.launchNotification.count({ where: { campaignId: existing.id } }) };
    }
    const campaign = await prisma.launchCampaign.create({ data: input });
    // One statement snapshots eligibility; repeating the campaign key does not enroll new people.
    await prisma.$executeRaw`INSERT INTO "LaunchNotification" ("id", "idempotencyKey", "subscriberId", "campaignId", "kind", "channel", "status", "updatedAt")
      SELECT gen_random_uuid()::text, ${`campaign:${campaign.id}:`} || "id", "id", ${campaign.id}, 'LAUNCH', ${input.channel}, 'HELD', NOW()
      FROM "LaunchSubscriber" WHERE "status" = 'VERIFIED'
      AND ((${input.channel} = 'EMAIL' AND "emailConsent" = true) OR (${input.channel} = 'WHATSAPP' AND "whatsappConsent" = true))
      ON CONFLICT ("idempotencyKey") DO NOTHING`;
    return { campaignId: campaign.id, queued: await prisma.launchNotification.count({ where: { campaignId: campaign.id } }) };
  });
}
