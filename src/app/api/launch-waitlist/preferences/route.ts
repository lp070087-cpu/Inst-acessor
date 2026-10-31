import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
import { readLaunchBody } from "@/lib/launch-waitlist/validation";
import { launchPreferencesSchema } from "@/lib/launch-waitlist/admin-validation";
import { readLaunchPreferences, updateLaunchPreferences } from "@/lib/launch-waitlist/preferences";
import { unsubscribeLaunchSubscriber } from "@/lib/launch-waitlist/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Token-authorised preferences. Never returns name, email or phone; invalid tokens get a generic answer. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const invalid = () => NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404, headers });
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
    if (!await dbRateLimiter.check(`launch:preferences:${clientIp(request)}`, { max: 30, windowMs: 900_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429, headers });
    const parsed = launchPreferencesSchema.safeParse(await readLaunchBody(request));
    if (!parsed.success) return invalid();
    const input = parsed.data;
    if (input.action === "unsubscribe") {
      if (!await unsubscribeLaunchSubscriber(input.token)) return invalid();
      return NextResponse.json({ ok: true, preferences: { status: "UNSUBSCRIBED", emailConsent: false, whatsappConsent: false } }, { headers });
    }
    const preferences = input.action === "read"
      ? await readLaunchPreferences(input.token)
      : await updateLaunchPreferences(input.token, { emailConsent: input.emailConsent, whatsappConsent: input.whatsappConsent });
    if (!preferences) return invalid();
    return NextResponse.json({ ok: true, preferences }, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível processar agora." }, { status: 503, headers }); }
}
