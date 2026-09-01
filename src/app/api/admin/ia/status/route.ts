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
    // Indicador seguro: a criptografia de credenciais está pronta para SALVAR?
    // Booleano — nunca revela a chave. Sem isso, o SAVE falharia com 500 genérico.
    const encryptionReady = (process.env.TOKEN_ENCRYPTION_KEY ?? "").trim().length >= 32;
    return NextResponse.json({ status, encryptionReady });
  } catch (err) {
    console.error("[admin/ia/status] erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o estado da IA." },
      { status: 500 }
    );
  }
}
