import { NextResponse } from "next/server";
import { getSession } from "./config";
import { isSameOriginMutation } from "./request-origin";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";

/** Guard free authenticated features without changing the commercial policy. */
export function withSessionApi<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    if (args[0] instanceof Request && !isSameOriginMutation(args[0])) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!(await dbRateLimiter.check(`session-api:${session.user.id}`, { windowMs: 60_000, max: 120 }))) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }
    return handler(...args);
  };
}
