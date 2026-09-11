import { NextResponse } from "next/server";

import { listPlans } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/plans — lista os planos oficiais ativos.
 * PÚBLICO (a landing e o checkout sem login precisam listar os planos para o
 * visitante escolher). Nenhum dado sensível; preço/duração/ciclo são apenas a
 * vitrine do catálogo — o valor cobrado é SEMPRE resolvido no servidor no
 * momento do checkout (nunca confiar nestes campos como fonte de cobrança).
 */
export async function GET() {
  try {
    const plans = await listPlans();
    return NextResponse.json({ plans });
  } catch (err) {
    console.error("[billing/plans] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar os planos." }, { status: 500 });
  }
}
