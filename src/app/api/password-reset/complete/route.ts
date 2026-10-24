import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { completePasswordReset, readPasswordResetBody, PASSWORD_RESET_INVALID_MESSAGE } from "@/lib/auth/password-reset";
import { clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const invalid = () => NextResponse.json({ ok: false, error: PASSWORD_RESET_INVALID_MESSAGE }, { status: 400, headers });
  if (!isSameOriginMutation(request)) return invalid();
  try {
  const body = await readPasswordResetBody(request);
  if (!body || typeof body !== "object" || !("token" in body) || !("password" in body)) return invalid();
  return await completePasswordReset(body.token, body.password, clientIp(request)) ? NextResponse.json({ ok: true }, { headers }) : invalid();
  } catch { return invalid(); }
}
