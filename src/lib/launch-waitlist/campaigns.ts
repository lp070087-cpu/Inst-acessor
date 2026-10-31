import type { Prisma } from "@prisma/client";
import { prisma, withDatabaseTransaction } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { getOfficialSiteUrl } from "@/lib/config/site";
import { isTransactionalEmailConfigured } from "@/lib/email";
import { isWhatsAppConfigured } from "@/lib/whatsapp/cloud-api";
import type { LaunchCampaignContent, LaunchCampaignKind } from "./service";
import { NEWS_BODY_MAX, NEWS_SUBJECT_MAX } from "./templates";

/**
 * CAMPAIGN LIFECYCLE (admin-only)
 *   PREPARED  → rows HELD (snapshot). Nothing is sent.
 *   SENDING   → set ONLY by confirmLaunchCampaignSend after the admin retyped the
 *               campaign key (and, for LAUNCH, explicitly approved the presale).
 *               campaign-worker.ts may then promote HELD → READY just in time.
 *   COMPLETED → no deliverable row left.
 * Nothing in this module or the worker moves a campaign to SENDING by itself.
 */
export type LaunchCampaignStatus = "PREPARED" | "SENDING" | "COMPLETED";
export const LAUNCH_CAMPAIGN_MAX_ATTEMPTS = 3;

export type LaunchCampaignErrorCode = "NOT_FOUND" | "NOT_PREPARED" | "TRANSPORT_NOT_CONFIGURED" | "PRESALE_APPROVAL_REQUIRED" | "CONTENT_MISSING" | "URL_NOT_OFFICIAL" | "CAMPAIGN_CONFLICT";
export class LaunchCampaignError extends Error {
  readonly code: LaunchCampaignErrorCode;
  constructor(code: LaunchCampaignErrorCode) {
    super(code);
    this.code = code;
  }
}

async function lock(key: string) {
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:launch'), hashtext(${key}))::text`;
}

/** Accepts only URLs on the official site origin (https in production). */
export function isOfficialSiteUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value), official = new URL(getOfficialSiteUrl());
    return !url.username && !url.password && url.origin === official.origin;
  } catch { return false; }
}

/** Server-side content checks shared by prepare and send. Throws LaunchCampaignError. */
export function assertCampaignContent(channel: string, kind: LaunchCampaignKind, content: LaunchCampaignContent | null) {
  if (!content) throw new LaunchCampaignError("CONTENT_MISSING");
  if (kind === "LAUNCH") {
    if (!content.saleUrl) throw new LaunchCampaignError("CONTENT_MISSING");
    if (!isOfficialSiteUrl(content.saleUrl)) throw new LaunchCampaignError("URL_NOT_OFFICIAL");
    return;
  }
  if (content.ctaUrl && !isOfficialSiteUrl(content.ctaUrl)) throw new LaunchCampaignError("URL_NOT_OFFICIAL");
  if (channel === "EMAIL" && (!content.subject || content.subject.length > NEWS_SUBJECT_MAX || !content.body || content.body.length > NEWS_BODY_MAX)) {
    throw new LaunchCampaignError("CONTENT_MISSING");
  }
}

export function decodeCampaignPayload(payload: string | null): (LaunchCampaignContent & { kind?: string }) | null {
  if (!payload) return null;
  try {
    const value: unknown = JSON.parse(decryptToken(payload));
    if (!value || typeof value !== "object") return null;
    const { kind, saleUrl, subject, body, ctaUrl } = value as Record<string, unknown>;
    const text = (item: unknown) => typeof item === "string" ? item : undefined;
    return { kind: text(kind), saleUrl: text(saleUrl), subject: text(subject), body: text(body), ctaUrl: text(ctaUrl) };
  } catch { return null; }
}

export function isCampaignTransportReady(channel: string, kind?: LaunchCampaignKind): boolean {
  if (channel === "EMAIL") return process.env.LAUNCH_EMAIL_WORKER_ENABLED === "true" && isTransactionalEmailConfigured();
  if (channel === "WHATSAPP") return isWhatsAppConfigured(kind);
  return false;
}

/** Eligibility at send time: VERIFIED and consent for the campaign channel. */
export function eligibleSubscriberFilter(channel: string): Prisma.LaunchSubscriberWhereInput {
  return channel === "EMAIL" ? { status: "VERIFIED", emailConsent: true } : { status: "VERIFIED", whatsappConsent: true };
}

/**
 * Second confirmation. The caller (admin route) has already verified that the admin
 * typed the exact campaign key. Idempotent: confirming an already SENDING/COMPLETED
 * campaign changes nothing.
 */
export async function confirmLaunchCampaignSend(input: { key: string; presaleApproved?: boolean }) {
  return withDatabaseTransaction(async () => {
    await lock(`campaign:${input.key}`);
    const campaign = await prisma.launchCampaign.findUnique({ where: { key: input.key } });
    if (!campaign) throw new LaunchCampaignError("NOT_FOUND");
    if (campaign.status !== "PREPARED") {
      if (campaign.status === "SENDING" || campaign.status === "COMPLETED") return { campaignId: campaign.id, status: campaign.status, alreadyConfirmed: true, eligible: 0, cancelled: 0 };
      throw new LaunchCampaignError("NOT_PREPARED");
    }
    const sample = await prisma.launchNotification.findFirst({ where: { campaignId: campaign.id, status: "HELD", privatePayload: { not: null } }, select: { kind: true, privatePayload: true } })
      ?? await prisma.launchNotification.findFirst({ where: { campaignId: campaign.id }, select: { kind: true, privatePayload: true } });
    if (!sample) {
      // Nobody was eligible when prepared: nothing can ever be sent.
      await prisma.launchCampaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
      return { campaignId: campaign.id, status: "COMPLETED", alreadyConfirmed: false, eligible: 0, cancelled: 0 };
    }
    const kind = sample.kind === "NEWS" ? "NEWS" : "LAUNCH";
    const content = decodeCampaignPayload(sample.privatePayload);
    if (content?.kind && content.kind !== kind) throw new LaunchCampaignError("CAMPAIGN_CONFLICT");
    assertCampaignContent(campaign.channel, kind, content);
    if (kind === "LAUNCH" && input.presaleApproved !== true) throw new LaunchCampaignError("PRESALE_APPROVAL_REQUIRED");
    if (!isCampaignTransportReady(campaign.channel, kind)) throw new LaunchCampaignError("TRANSPORT_NOT_CONFIGURED");
    const cancelled = await prisma.launchNotification.updateMany({
      where: { campaignId: campaign.id, status: { in: ["HELD", "READY"] }, NOT: { subscriber: { is: eligibleSubscriberFilter(campaign.channel) } } },
      data: { status: "CANCELLED", privatePayload: null, errorCode: "INELIGIBLE_AT_SEND" },
    });
    await prisma.launchCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
    const eligible = await prisma.launchNotification.count({ where: { campaignId: campaign.id, status: "HELD" } });
    return { campaignId: campaign.id, status: "SENDING", alreadyConfirmed: false, eligible, cancelled: cancelled.count };
  });
}
