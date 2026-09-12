import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { completeTour } from "@/lib/first-access";
import { createRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tourRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * POST /api/first-access/tour
 * Registra a conclusão ou o pulo do tour guiado (owner-checked).
 * O tour NÃO é reexibido automaticamente nos próximos logins.
 */
export async function POST(request: Request) {
  if (!tourRateLimiter.check(clientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  try {
    const session = await requireSession();
    const result = await completeTour(session.user.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível registrar o tour." }, { status: 500 });
  }
}
