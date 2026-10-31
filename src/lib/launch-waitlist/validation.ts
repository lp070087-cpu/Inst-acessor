import { z } from "zod";

export const CONSENT_VERSION = "launch-2026-10-20-v1";
export const LAUNCH_ACCEPTED_MESSAGE = "Se os dados estiverem aptos, sua solicitação será registrada. A confirmação por email depende da ativação do serviço de envio.";
export const launchSignupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  whatsapp: z.string().regex(/^\+[1-9]\d{7,14}$/),
  planSlug: z.enum(["semanal", "mensal", "anual"]),
  emailConsent: z.boolean(),
  whatsappConsent: z.boolean(),
  source: z.enum(["landing-plan", "landing"]),
  // Aceite da Política de Privacidade: obrigatório e separado dos consentimentos
  // de marketing (ambos opcionais). Serve só de portão — não é persistido.
  privacyAccepted: z.literal(true),
  website: z.string().max(200).optional().default(""),
}).strict();
export type LaunchSignup = z.infer<typeof launchSignupSchema>;
export const launchTokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const launchCampaignSchema = z.object({ key: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/), channel: z.enum(["EMAIL", "WHATSAPP"]), confirmQueue: z.literal(true) }).strict();

/** Anonymous requests are bounded before JSON parsing. */
export async function readLaunchBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; } finally { reader.releaseLock(); }
}
