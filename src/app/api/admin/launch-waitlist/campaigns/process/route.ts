import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/auth/admin-api";
import { prisma } from "@/lib/db";
import { readLaunchBody } from "@/lib/launch-waitlist/validation";
import { launchCampaignProcessSchema } from "@/lib/launch-waitlist/admin-validation";
import { processLaunchCampaignMessages } from "@/lib/launch-waitlist/campaign-worker";
import { clientIp, dbRateLimiter } from "@/lib/publishing/rate-limit";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual "process next batch" for a campaign the admin ALREADY confirmed (SENDING).
 * Same worker as the cron; does nothing for PREPARED campaigns. Counts only.
 */
const handler = withAdminApi(async (request: Request) => {
  if (!await dbRateLimiter.check(`launch:campaign-process:${clientIp(request)}`, { max: 6, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde e tente novamente." }, { status: 429 });
  const parsed = launchCampaignProcessSchema.safeParse(await readLaunchBody(request));
  if (!parsed.success) return NextResponse.json({ error: "Campanha inválida." }, { status: 400 });
  const campaign = await prisma.launchCampaign.findUnique({ where: { key: parsed.data.key }, select: { id: true, channel: true, status: true } });
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.status !== "SENDING" || !["EMAIL", "WHATSAPP"].includes(campaign.channel)) return NextResponse.json({ error: "Somente campanhas com envio confirmado podem ser processadas." }, { status: 409 });
  const result = await processLaunchCampaignMessages(campaign.channel as "EMAIL" | "WHATSAPP", { campaignId: campaign.id, deadline: Date.now() + 40_000 });
  return NextResponse.json({ ok: true, ...result });
});
export async function POST(request: Request) {
  try { const response = await handler(request); response.headers.set("Cache-Control", "no-store"); return response; }
  catch { return NextResponse.json({ error: "Não foi possível processar o lote." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
