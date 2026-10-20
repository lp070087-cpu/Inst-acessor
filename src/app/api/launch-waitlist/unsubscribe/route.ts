import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
import { launchTokenSchema, readLaunchBody } from "@/lib/launch-waitlist/validation";
import { unsubscribeLaunchSubscriber } from "@/lib/launch-waitlist/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
    if (!await dbRateLimiter.check(`launch:unsubscribe:${clientIp(request)}`, { max: 20, windowMs: 900_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429, headers });
    const parsed = launchTokenSchema.safeParse(await readLaunchBody(request));
    if (parsed.success) await unsubscribeLaunchSubscriber(parsed.data.token);
    return NextResponse.json({ ok: true, message: "Se o link estiver válido, os avisos serão cancelados." }, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível processar agora." }, { status: 503, headers }); }
}
