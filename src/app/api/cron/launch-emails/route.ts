import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processLaunchEmails } from "@/lib/launch-waitlist/email-worker";
import { processLaunchCampaignMessages } from "@/lib/launch-waitlist/campaign-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const BUDGET_MS = 45_000;

/**
 * Launch waitlist messages, one CRON_SECRET:
 *   - transactional EMAIL VERIFY/WELCOME + campaign EMAIL (NEWS/LAUNCH), gated by LAUNCH_EMAIL_WORKER_ENABLED;
 *   - campaign WHATSAPP (approved templates), gated by WHATSAPP_WORKER_ENABLED.
 * Campaign rows move only for campaigns an admin confirmed (SENDING). Responses carry counts, never personal data.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Scheduler não configurado." }, { status: 503, headers: NO_STORE });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
  }
  const emailEnabled = process.env.LAUNCH_EMAIL_WORKER_ENABLED === "true";
  const whatsappEnabled = process.env.WHATSAPP_WORKER_ENABLED === "true";
  if (!emailEnabled && !whatsappEnabled) {
    return NextResponse.json({ enabled: false, processed: 0 }, { status: 503, headers: NO_STORE });
  }
  const startedAt = Date.now();
  const deadline = startedAt + BUDGET_MS;
  try {
    const transactional = emailEnabled ? await processLaunchEmails() : null;
    // A campaign failure must not hide the transactional counts (and vice versa).
    const campaign = async (channel: "EMAIL" | "WHATSAPP") => {
      try { return await processLaunchCampaignMessages(channel, { deadline }); }
      catch { console.error(`[launch-emails-cron] campanha ${channel} não concluída`); return { channel, error: true }; }
    };
    const campaignEmail = emailEnabled ? await campaign("EMAIL") : null;
    const whatsapp = whatsappEnabled ? await campaign("WHATSAPP") : null;
    const body = { enabled: emailEnabled, whatsappEnabled, ...(transactional ?? {}), campaignEmail, whatsapp };
    console.info("[launch-emails-cron]", { ...body, elapsedMs: Date.now() - startedAt });
    return NextResponse.json(body, { headers: NO_STORE });
  } catch {
    console.error("[launch-emails-cron] processamento não concluído");
    return NextResponse.json({ error: "Falha no processamento." }, { status: 500, headers: NO_STORE });
  }
}

export const GET = handle;
export const POST = handle;
