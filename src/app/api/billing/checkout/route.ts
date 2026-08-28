import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { startCheckout } from "@/lib/billing/checkout";
import { checkoutStartSchema } from "@/lib/validators/billing";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout — inicia o checkout de um plano.
 * Requer sessão + Zod. Como o gateway real NÃO está configurado, retorna
 * sempre o estado controlado "Pagamento online em configuração." — sem URL
 * fake, sem checkout falso.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = checkoutStartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const result = await startCheckout(userId, parsed.data.planId);
    if (!result.ok && result.status === "INTEGRATION_NOT_CONFIGURED") {
      // Estado controlado esperado — o pagamento está em configuração.
      return NextResponse.json({ ok: false, status: result.status, message: result.message });
    }

    return NextResponse.json({ ok: true, checkout: result });
  } catch (err) {
    console.error("[billing/checkout] erro ao iniciar checkout", err);
    return NextResponse.json({ error: "Erro ao iniciar o checkout." }, { status: 500 });
  }
}
