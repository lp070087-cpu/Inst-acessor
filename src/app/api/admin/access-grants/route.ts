import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { bll } from "@/lib/billing/db";

export const dynamic = "force-dynamic";

interface AccessGrantRow {
  id: string;
  email: string;
  planName: string | null;
  origin: string;
  status: string;
  startAt: Date | null;
  expiresAt: Date | null;
  firstAccessCompleted: boolean;
  firstAccessCompletedAt: Date | null;
  createdAt: Date;
}

/**
 * GET /api/admin/access-grants
 * Lista as liberações de acesso (somente ADMIN).
 * Mostra e-mail, origem, plano, período, status e primeiro acesso.
 * Nunca expõe tokens/passwordHash.
 */
export async function GET() {
  await requireAdminSession();

  const rows = (await bll.accessGrant.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })) as unknown as AccessGrantRow[];

  return NextResponse.json({
    ok: true,
    grants: rows.map((g) => ({
      id: g.id,
      email: g.email,
      planName: g.planName,
      origin: g.origin,
      status: g.status,
      startAt: g.startAt?.toISOString() ?? null,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      firstAccessCompleted: g.firstAccessCompleted,
      firstAccessCompletedAt: g.firstAccessCompletedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
  });
}
