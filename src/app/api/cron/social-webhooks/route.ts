import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processTikTokInbox } from "@/lib/integrations/tiktok/webhook-inbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Scheduler não configurado." }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try { return NextResponse.json(await processTikTokInbox(10)); }
  catch {
    console.error("[social-webhooks-cron] processamento local não concluído");
    return NextResponse.json({ error: "Processamento não concluído." }, { status: 503 });
  }
}
