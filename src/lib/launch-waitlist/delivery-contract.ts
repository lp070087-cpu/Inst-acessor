/** Contracts for the launch outbox transports. No fetch, provider SDK or timer lives here. */
export type LaunchEmailContract = {
  provider: "RESEND";
  recipient: string;
  idempotencyKey: string;
  kind: "VERIFY" | "WELCOME" | "LAUNCH" | "NEWS";
  confirmationUrl?: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
};

/**
 * WhatsApp Business Platform (Cloud API) contract.
 *
 * OPT-IN EVIDENCE (recorded honestly): the WhatsApp opt-in is the explicit,
 * unticked-by-default checkbox on the waitlist form, stored as a LaunchConsent
 * row, followed by the EMAIL double opt-in (the subscriber must confirm through
 * the link sent to their email before becoming VERIFIED). This proves control
 * of the email address, NOT ownership of the phone number: consent alone is not
 * evidence of phone ownership. Mitigations kept in code:
 *   - only VERIFIED subscribers with whatsappConsent=true at send time;
 *   - no automatic WhatsApp message at all (no VERIFY/WELCOME): only campaigns
 *     an admin prepared AND confirmed by typing the campaign key;
 *   - only Meta-approved templates (marketing opt-out button recommended);
 *   - consent can be revoked at /lista-de-espera/preferencias or /cancelar.
 */
export type LaunchWhatsAppContract = {
  provider: "META_WHATSAPP_CLOUD";
  recipientE164: string;
  approvedTemplateName: string;
  languageCode: string;
  idempotencyKey: string;
  optInEvidence: "WAITLIST_FORM_CHECKBOX_AND_EMAIL_DOUBLE_OPT_IN";
  phoneOwnershipVerified: false;
  unsubscribeUrl: string;
};

export function buildLaunchPrivateLinks(origin: string, verificationToken: string, unsubscribeToken: string) {
  const base = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || base.pathname !== "/" || base.search || base.hash ||
    (local ? !["development", "test"].includes(process.env.NODE_ENV ?? "") : base.protocol !== "https:" || !!base.port) ||
    !["http:", "https:"].includes(base.protocol) ||
    !/^[a-f0-9]{64}$/.test(verificationToken) || !/^[a-f0-9]{64}$/.test(unsubscribeToken)) throw new Error("INVALID_LAUNCH_LINK_CONFIGURATION");
  const confirmation = new URL("/lista-de-espera/confirmar", base);
  const unsubscribe = new URL("/lista-de-espera/cancelar", base);
  // Same capability as unsubscribe (the token stays in the fragment, never sent to servers or logs).
  const preferences = new URL("/lista-de-espera/preferencias", base);
  confirmation.hash = new URLSearchParams({ token: verificationToken }).toString();
  unsubscribe.hash = new URLSearchParams({ token: unsubscribeToken }).toString();
  preferences.hash = new URLSearchParams({ token: unsubscribeToken }).toString();
  return { confirmationUrl: confirmation.toString(), unsubscribeUrl: unsubscribe.toString(), preferencesUrl: preferences.toString() };
}
