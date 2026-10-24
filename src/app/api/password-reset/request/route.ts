import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { requestPasswordReset, readPasswordResetBody, PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset";
import { clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Solicitação não permitida." }, { status: 403, headers });
  try {
  const body = await readPasswordResetBody(request);
  const email = body && typeof body === "object" && "email" in body ? body.email : undefined;
  const outcome = await requestPasswordReset(email, clientIp(request), request.url);
  if (outcome === "limited") return NextResponse.json({ error: "Não foi possível processar agora. Aguarde e tente novamente." }, { status: 429, headers });
  return NextResponse.json({ ok: true, message: PASSWORD_RESET_REQUEST_MESSAGE }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível processar agora. Aguarde e tente novamente." }, { status: 503, headers });
  }
}
