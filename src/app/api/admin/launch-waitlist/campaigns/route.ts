import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/auth/admin-api";
import { readLaunchBody } from "@/lib/launch-waitlist/validation";
import { launchCampaignPrepareSchema } from "@/lib/launch-waitlist/admin-validation";
import { prepareLaunchCampaign } from "@/lib/launch-waitlist/service";
import { LaunchCampaignError, assertCampaignContent } from "@/lib/launch-waitlist/campaigns";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
export const dynamic = "force-dynamic";

/** Step 1: prepare (snapshot into HELD rows). Never sends; sending needs the typed confirmation in ./send. */
const handler = withAdminApi(async (request: Request) => {
  if (!await dbRateLimiter.check(`launch:campaign:${clientIp(request)}`, { max: 5, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429 });
  const parsed = launchCampaignPrepareSchema.safeParse(await readLaunchBody(request));
  if (!parsed.success) return NextResponse.json({ error: "Confirme o preparo e revise os campos." }, { status: 400 });
  try { assertCampaignContent(parsed.data.channel, parsed.data.kind, parsed.data.content); }
  catch (error) {
    const message = error instanceof LaunchCampaignError && error.code === "URL_NOT_OFFICIAL" ? "Os links devem apontar para o site oficial." : "Revise o conteúdo da campanha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    const result = await prepareLaunchCampaign(parsed.data);
    return NextResponse.json({ ok: true, ...result, kind: parsed.data.kind, deliveryEnabled: false });
  } catch (error) {
    if (error instanceof Error && error.message === "CAMPAIGN_CONFLICT") return NextResponse.json({ error: "Este identificador já pertence a outra campanha (tipo ou canal diferente)." }, { status: 409 });
    throw error;
  }
});
export async function POST(request: Request) {
  try { const response = await handler(request); response.headers.set("Cache-Control", "no-store"); return response; }
  catch { return NextResponse.json({ error: "Não foi possível preparar a campanha." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
