import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/auth/admin-api";
import { launchCampaignSchema, readLaunchBody } from "@/lib/launch-waitlist/validation";
import { prepareLaunchCampaign } from "@/lib/launch-waitlist/service";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
export const dynamic = "force-dynamic";
const handler = withAdminApi(async (request: Request) => {
  if (!await dbRateLimiter.check(`launch:campaign:${clientIp(request)}`, { max: 5, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429 });
  const parsed = launchCampaignSchema.safeParse(await readLaunchBody(request));
  if (!parsed.success) return NextResponse.json({ error: "Confirme o preparo e revise os campos." }, { status: 400 });
  const result = await prepareLaunchCampaign({ key: parsed.data.key, channel: parsed.data.channel });
  return NextResponse.json({ ok: true, ...result, deliveryEnabled: false });
});
export async function POST(request: Request) {
  try { const response = await handler(request); response.headers.set("Cache-Control", "no-store"); return response; }
  catch { return NextResponse.json({ error: "Não foi possível preparar a campanha." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
