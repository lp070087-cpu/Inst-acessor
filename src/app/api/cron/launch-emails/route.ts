import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processLaunchEmails } from "@/lib/launch-waitlist/email-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** Transactional waitlist emails only (EMAIL VERIFY/WELCOME). Responses carry counts, never personal data. */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Scheduler não configurado." }, { status: 503, headers: NO_STORE });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
  }
  if (process.env.LAUNCH_EMAIL_WORKER_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, processed: 0 }, { status: 503, headers: NO_STORE });
  }
  const startedAt = Date.now();
  try {
    const result = await processLaunchEmails();
    console.info("[launch-emails-cron]", { ...result, elapsedMs: Date.now() - startedAt });
    return NextResponse.json({ enabled: true, ...result }, { headers: NO_STORE });
  } catch {
    console.error("[launch-emails-cron] processamento não concluído");
    return NextResponse.json({ error: "Falha no processamento." }, { status: 500, headers: NO_STORE });
  }
}

export const GET = handle;
export const POST = handle;
