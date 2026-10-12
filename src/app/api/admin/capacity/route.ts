import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { getCapacityConfig, saveCapacityConfig } from "@/lib/billing/capacity-db";
import { DEFAULT_CAPACITY } from "@/lib/billing/capacity";

export const dynamic = "force-dynamic";

/**
 * CAPACIDADE DE VENDAS — CONFIGURAÇÃO (somente ADMIN)
 * ====================================================
 * GET  /api/admin/capacity → config atual + uso real
 * POST /api/admin/capacity → grava a config (normalizada no servidor)
 *
 * Persistência: `SystemSetting` (JÁ EXISTE) com a key `billing.capacity.v1` —
 * NENHUMA migration. Esta é a ÚNICA forma de ligar/desligar uma vaga, e ela só
 * é acessível ao ADMIN. O bloqueio real acontece em `startPublicCheckout`.
 */
export async function GET() {
  await requireAdminSession();
  try {
    const config = await getCapacityConfig();
    return NextResponse.json({ ok: true, config, defaults: DEFAULT_CAPACITY });
  } catch {
    console.error("[admin-capacity] falha ao ler a configuração");
    return NextResponse.json(
      { error: "Não foi possível ler a configuração." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  await requireAdminSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // `saveCapacityConfig` normaliza campo a campo e devolve o que REALMENTE
  // ficou gravado. `signupsOpen` só vira `false` se literalmente false — fechar
  // vendas por acidente de tipo seria o pior desfecho.
  try {
    const raw = (body as { config?: unknown })?.config ?? body;
    const saved = await saveCapacityConfig(raw);
    return NextResponse.json({ ok: true, config: saved });
  } catch {
    console.error("[admin-capacity] falha ao gravar a configuração");
    return NextResponse.json(
      { error: "Não foi possível salvar a configuração." },
      { status: 500 }
    );
  }
}
