import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/config";
import { isSameOriginMutation } from "@/lib/auth/request-origin";
import { reconcilePublication } from "@/lib/publishing/reconciliation";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { prisma } from "@/lib/db";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { hasVerifiedIdentity } from "@/lib/auth/identity";

export const dynamic = "force-dynamic";
const schema = z.object({ queueId: z.string().min(1).max(200), externalId: z.string().regex(/^[a-zA-Z0-9_.~-]{1,200}$/), reviewedContent: z.literal(true) }).strict();

async function authorizedAdmin(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true, status: true, emailVerified: true, firstAccessCompleted: true } });
  return !!user && user.status === "ACTIVE" && hasVerifiedIdentity(user) && isOfficialAdminEmail(user.email);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    if (!await authorizedAdmin(session.user.id)) return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
    const items = await prisma.publishQueue.findMany({ where: { status: "FALHOU", errorCode: "RECONCILIATION_REQUIRED" },
      orderBy: { updatedAt: "asc" }, take: 50,
      select: { id: true, platform: true, externalId: true, content: { select: { title: true } } } });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a conferência." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const user = session.user;
  if (!await authorizedAdmin(user.id)) return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
  if (!await dbRateLimiter.check(`publishing-reconcile:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Aguarde antes de conferir novamente." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise o ID e confirme a correspondência do conteúdo." }, { status: 400 });
  try {
    const result = await reconcilePublication({ ...parsed.data, actorId: user.id });
    return NextResponse.json(result, { status: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : result.code === "INVALID" ? 400 : 409 });
  } catch {
    console.error("[publishing-reconciliation] conferência não concluída");
    return NextResponse.json({ error: "Não foi possível conferir; a publicação permanece protegida contra reenvio." }, { status: 503 });
  }
}
