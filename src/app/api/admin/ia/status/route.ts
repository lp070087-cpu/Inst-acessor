import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { getAIAdminStatus } from "@/lib/admin/ai-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ia/status
 * Estado da IA para o admin. NUNCA devolve a chave completa —
 * apenas o sufixo mascarado (ex.: `sk-••••••••••••abcd`).
 */
export async function GET() {
  // Autorização ADMIN no servidor — redireciona se não for admin.
  await requireAdminSession();

  try {
    const status = await getAIAdminStatus();
    return NextResponse.json({ status });
  } catch (err) {
    console.error("[admin/ia/status] erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o estado da IA." },
      { status: 500 }
    );
  }
}
