import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { getAdminOverview } from "@/lib/admin/stats";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview
 * Métricas reais do Dashboard administrativo. NUNCA inventa números.
 */
export async function GET() {
  await requireAdminSession();

  try {
    const overview = await getAdminOverview();
    return NextResponse.json({ overview });
  } catch (err) {
    console.error("[admin/overview] erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o painel administrativo." },
      { status: 500 }
    );
  }
}
