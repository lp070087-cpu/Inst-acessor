import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { listPlans } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/plans — lista os planos oficiais ativos.
 * Requer sessão. Sem dados sensíveis.
 */
export async function GET() {
  try {
    await requireSession();
    const plans = await listPlans();
    return NextResponse.json({ plans });
  } catch (err) {
    console.error("[billing/plans] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar os planos." }, { status: 500 });
  }
}
