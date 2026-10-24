import { NextResponse } from "next/server";
import { getSession } from "./config";
import { prisma } from "@/lib/db";
import { isOfficialAdminEmail } from "./admin-access";
import { hasVerifiedIdentity } from "./identity";
import { isSameOriginMutation } from "./request-origin";

export function withAdminApi<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    if (args[0] instanceof Request && !isSameOriginMutation(args[0])) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, status: true, emailVerified: true, firstAccessCompleted: true } });
    if (!user || user.status !== "ACTIVE" || !hasVerifiedIdentity(user) || !isOfficialAdminEmail(user.email)) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    return handler(...args);
  };
}
