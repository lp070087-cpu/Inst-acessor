import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
import { launchSignupSchema, readLaunchBody, LAUNCH_ACCEPTED_MESSAGE } from "@/lib/launch-waitlist/validation";
import { registerLaunchSubscriber } from "@/lib/launch-waitlist/service";
import { triggerLaunchEmails } from "@/lib/launch-waitlist/email-trigger";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  try {
    if (!await dbRateLimiter.check(`launch:ip:${clientIp(request)}`, { max: 10, windowMs: 900_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429, headers });
    const parsed = launchSignupSchema.safeParse(await readLaunchBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Revise os campos e os consentimentos." }, { status: 400, headers });
    if (!parsed.data.website) {
      const emailHash = createHash("sha256").update(parsed.data.email).digest("hex");
      if (!await dbRateLimiter.check(`launch:email:${emailHash}`, { max: 3, windowMs: 900_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429, headers });
      await registerLaunchSubscriber(parsed.data);
      after(triggerLaunchEmails);
    }
    return NextResponse.json({ ok: true, message: LAUNCH_ACCEPTED_MESSAGE }, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível registrar agora. Tente mais tarde." }, { status: 503, headers }); }
}
