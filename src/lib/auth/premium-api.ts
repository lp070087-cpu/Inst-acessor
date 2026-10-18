import { NextResponse } from "next/server";
import { getSession } from "./config";
import { resolvePremiumAccess } from "@/lib/access/premium";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { isSameOriginMutation } from "./request-origin";

/** Authenticate and authorize before any premium handler reads or mutates data. */
export function withPremiumApi<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    if (args[0] instanceof Request && !isSameOriginMutation(args[0])) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const access = await resolvePremiumAccess(session.user.id);
    if (!access.hasAccess) return NextResponse.json({ error: "Acesso ao plano necessário." }, { status: 403 });
    if (!(await dbRateLimiter.check(`premium-api:${session.user.id}`, { windowMs: 60_000, max: 60 }))) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }
    return handler(...args);
  };
}
