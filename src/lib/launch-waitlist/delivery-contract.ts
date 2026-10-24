/** Preparation only. No fetch, provider SDK, queue consumer or background timer. */
export type LaunchEmailContract = {
  provider: "RESEND";
  recipient: string;
  idempotencyKey: string;
  kind: "VERIFY" | "WELCOME" | "LAUNCH";
  confirmationUrl?: string;
  unsubscribeUrl: string;
};
export type LaunchWhatsAppContract = {
  provider: "META_WHATSAPP_CLOUD";
  recipientE164: string;
  approvedTemplateName: string;
  languageCode: string;
  idempotencyKey: string;
  // Consent alone is not evidence of phone ownership or approved messaging authorization.
  phoneOwnershipVerified: true;
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
  confirmation.hash = new URLSearchParams({ token: verificationToken }).toString();
  unsubscribe.hash = new URLSearchParams({ token: unsubscribeToken }).toString();
  return { confirmationUrl: confirmation.toString(), unsubscribeUrl: unsubscribe.toString() };
}
