import { NextResponse, after } from "next/server";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
import { launchTokenSchema, readLaunchBody } from "@/lib/launch-waitlist/validation";
import { confirmLaunchSubscription } from "@/lib/launch-waitlist/service";
import { triggerLaunchEmails } from "@/lib/launch-waitlist/email-trigger";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
    if (!await dbRateLimiter.check(`launch:confirm:${clientIp(request)}`, { max: 20, windowMs: 900_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429, headers });
    const parsed = launchTokenSchema.safeParse(await readLaunchBody(request));
    if (!parsed.success || !await confirmLaunchSubscription(parsed.data.token)) return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 400, headers });
    after(triggerLaunchEmails);
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível confirmar agora." }, { status: 503, headers }); }
}
