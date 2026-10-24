import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processQueue } from "@/lib/publishing/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Scheduler não configurado." }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (process.env.PUBLISHING_WORKER_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, processed: 0 });
  }
  const startedAt = Date.now();
  try {
    const result = await processQueue(1);
    console.info("[publishing-cron]", { ...result, elapsedMs: Date.now() - startedAt });
    return NextResponse.json(result);
  } catch {
    console.error("[publishing-cron] processamento não concluído");
    return NextResponse.json({ error: "Falha no processamento." }, { status: 500 });
  }
}
