import { z } from "zod";

export const TIKTOK_PRIVACY = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"] as const;
export const tiktokPublishingOptionsSchema = z.object({
  version: z.literal(1), accountId: z.string().min(1).max(256),
  privacy: z.enum(TIKTOK_PRIVACY), allowComment: z.boolean(), allowDuet: z.boolean(), allowStitch: z.boolean(),
  commercial: z.boolean(), ownBrand: z.boolean(), thirdPartyBrand: z.boolean(), aiGenerated: z.boolean(),
  durationSec: z.number().finite().positive().max(600),
  contentBinding: z.string().min(1).max(12000),
  musicConsent: z.literal(true), brandedPolicyConsent: z.boolean(),
  uploadConsent: z.literal(true), consentAt: z.string().datetime({ offset: true }),
}).strict();
export type TikTokPublishingOptions = z.infer<typeof tiktokPublishingOptionsSchema>;
export interface TikTokCreatorInfo {
  accountId: string;
  nickname: string;
  username: string;
  privacyOptions: (typeof TIKTOK_PRIVACY)[number][];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec: number;
  fetchedAt: string;
  audited: boolean;
}

/** Consent binds to the exact persisted caption, hashtags and final media URL.
 * This is correspondence metadata, not a signature or proof of platform approval. */
export function tiktokContentBinding(caption: string, hashtags: string, mediaUrl: string): string {
  return JSON.stringify([caption, hashtags, mediaUrl]);
}
export function hasTikTokPublishScope(scopes?: string | null): boolean {
  return (scopes ?? "").split(/[\s,]+/).includes("video.publish");
}
export function normalizeTikTokCreatorInfo(response: unknown, accountId: string, audited = false, now = Date.now()): TikTokCreatorInfo {
  const envelope = z.object({ error: z.object({ code: z.literal("ok") }), data: z.object({
    creator_nickname: z.string().min(1).max(240), creator_username: z.string().min(1).max(240),
    privacy_level_options: z.array(z.enum(TIKTOK_PRIVACY)).min(1).max(4),
    comment_disabled: z.boolean(), duet_disabled: z.boolean(), stitch_disabled: z.boolean(),
    max_video_post_duration_sec: z.number().int().positive().max(86400),
  }) }).safeParse(response);
  if (!envelope.success || !accountId) throw new Error("Não foi possível confirmar as permissões atuais do criador TikTok. Tente novamente mais tarde.");
  const data = envelope.data.data;
  if (!audited && data.privacy_level_options.includes("PUBLIC_TO_EVERYONE")) throw new Error("O teste de publicação deste aplicativo exige uma conta TikTok privada.");
  const privacyOptions = [...new Set(data.privacy_level_options)].filter(value => audited || value === "SELF_ONLY");
  if (!privacyOptions.length) throw new Error("A conta não oferece a privacidade permitida para este aplicativo em teste.");
  return { accountId, nickname: data.creator_nickname, username: data.creator_username, privacyOptions,
    commentDisabled: data.comment_disabled, duetDisabled: data.duet_disabled, stitchDisabled: data.stitch_disabled,
    maxDurationSec: data.max_video_post_duration_sec, fetchedAt: new Date(now).toISOString(), audited };
}
export function tiktokPublishingIssue(value: unknown, creator?: TikTokCreatorInfo, binding?: string, now = Date.now()): string | null {
  const parsed = tiktokPublishingOptionsSchema.safeParse(value);
  if (!parsed.success) return "Escolha as opções e confirme o envio e o uso de música para este conteúdo TikTok.";
  const options = parsed.data;
  if (Date.parse(options.consentAt) > now + 60_000) return "Data de consentimento inválida.";
  if (binding !== undefined && options.contentBinding !== binding) return "O conteúdo mudou. Revise as opções e confirme o envio novamente.";
  if (options.commercial && !options.ownBrand && !options.thirdPartyBrand) return "Informe se promove sua marca, outra marca ou ambas.";
  if (!options.commercial && (options.ownBrand || options.thirdPartyBrand)) return "Revise a divulgação de conteúdo comercial.";
  if (options.thirdPartyBrand && (!options.brandedPolicyConsent || options.privacy === "SELF_ONLY")) return "Parceria paga exige a política de conteúdo de marca e visibilidade que não seja Somente eu.";
  if (creator) {
    if (creator.accountId !== options.accountId) return "A conta TikTok mudou. Revise e autorize o conteúdo novamente.";
    if (now - Date.parse(creator.fetchedAt) > 5 * 60_000 || Date.parse(creator.fetchedAt) > now + 60_000) return "Atualize as opções atuais da conta TikTok.";
    if (!creator.privacyOptions.includes(options.privacy)) return "A privacidade escolhida não está disponível nesta conta.";
    if ((creator.commentDisabled && options.allowComment) || (creator.duetDisabled && options.allowDuet) || (creator.stitchDisabled && options.allowStitch)) return "As permissões de interação da conta mudaram. Revise as opções.";
    if (options.durationSec > creator.maxDurationSec) return "O vídeo excede a duração permitida para esta conta TikTok.";
  }
  return null;
}
export function isVerifiedTikTokMediaUrl(value: string, configuredOrigins: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return false;
    return configuredOrigins.split(",").some(candidate => {
      try { const origin = new URL(candidate.trim()); return origin.protocol === "https:" && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash && origin.origin === url.origin; }
      catch { return false; }
    });
  } catch { return false; }
}
/** Server callers provide the token; no token is returned to the browser.
 * Official endpoint: /v2/post/publish/creator_info/query/ (video.publish). */
export async function queryTikTokCreatorInfo(accessToken: string, accountId: string): Promise<TikTokCreatorInfo> {
  if (process.env.TIKTOK_PUBLISHING_ENABLED !== "true") throw new Error("Publicação TikTok desativada neste ambiente.");
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error("O TikTok não liberou as opções de publicação agora. Tente novamente mais tarde.");
  return normalizeTikTokCreatorInfo(await response.json(), accountId, process.env.TIKTOK_AUDITED_PUBLISHING_ENABLED === "true");
}
