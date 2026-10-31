import { z } from "zod";
import { NEWS_BODY_MAX, NEWS_SUBJECT_MAX, cleanNewsBody, cleanNewsSubject } from "./templates";

/**
 * Admin campaign + public preferences contracts. Kept apart from validation.ts
 * (public signup contract). Official-origin checks for URLs happen server-side
 * in campaigns.ts with getOfficialSiteUrl(); here only shape and scheme.
 */
const campaignKey = z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/);
const httpsUrl = z.string().trim().max(500).url().refine(value => value.startsWith("https://") || value.startsWith("http://localhost"), "https");

export const launchCampaignPrepareSchema = z.object({
  key: campaignKey,
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  kind: z.enum(["LAUNCH", "NEWS"]).default("LAUNCH"),
  confirmQueue: z.literal(true),
  subject: z.string().max(NEWS_SUBJECT_MAX * 2).optional(),
  body: z.string().max(NEWS_BODY_MAX * 2).optional(),
  ctaUrl: httpsUrl.optional(),
  saleUrl: httpsUrl.optional(),
}).strict().transform((input, ctx) => {
  if (input.kind === "LAUNCH") {
    if (!input.saleUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["saleUrl"], message: "SALE_URL_REQUIRED" });
    if (input.subject || input.body || input.ctaUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["kind"], message: "LAUNCH_USES_FIXED_TEXT" });
    return { key: input.key, channel: input.channel, kind: input.kind, content: { saleUrl: input.saleUrl } };
  }
  if (input.saleUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["saleUrl"], message: "NEWS_HAS_NO_SALE_URL" });
  const subject = cleanNewsSubject(input.subject ?? ""), body = cleanNewsBody(input.body ?? "");
  // WhatsApp NEWS uses the approved template text; email NEWS needs admin-authored content.
  if (input.channel === "EMAIL" && (subject.length < 3 || subject.length > NEWS_SUBJECT_MAX)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subject"], message: "SUBJECT_LENGTH" });
  if (input.channel === "EMAIL" && (body.length < 10 || body.length > NEWS_BODY_MAX)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "BODY_LENGTH" });
  return { key: input.key, channel: input.channel, kind: input.kind, content: {
    ...(subject ? { subject } : {}), ...(body ? { body } : {}), ...(input.ctaUrl ? { ctaUrl: input.ctaUrl } : {}),
  } };
});
export type LaunchCampaignPrepareInput = z.output<typeof launchCampaignPrepareSchema>;

/** Second, typed confirmation: the admin must retype the campaign key exactly. */
export const launchCampaignSendSchema = z.object({
  key: campaignKey,
  confirmKey: z.string().max(80),
  confirmSend: z.literal(true),
  presaleApproved: z.boolean().optional(),
}).strict().refine(input => input.confirmKey === input.key, { path: ["confirmKey"], message: "KEY_MISMATCH" });

export const launchCampaignProcessSchema = z.object({ key: campaignKey }).strict();

const token = z.string().regex(/^[a-f0-9]{64}$/);
export const launchPreferencesSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), token }).strict(),
  z.object({ action: z.literal("update"), token, emailConsent: z.boolean(), whatsappConsent: z.boolean() }).strict(),
  z.object({ action: z.literal("unsubscribe"), token }).strict(),
]);
