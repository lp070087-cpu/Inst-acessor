import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  getMySubscription,
  listMySubscriptions,
  cancelRenewal,
  getAccessStatus,
} from "@/lib/billing";
import { cancelRenewalSchema } from "@/lib/validators/billing";

export const dynamic = "force-dynamic";

/**
 * FASE 6.5 — MINHA ASSINATURA
 * ============================
 * GET    /api/billing/subscription — assinatura atual + status de acesso
 * PATCH  /api/billing/subscription — cancela renovação futura (owner-checked)
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const [current, history, access] = await Promise.all([
      getMySubscription(userId),
      listMySubscriptions(userId),
      getAccessStatus(userId),
    ]);

    return NextResponse.json({ current, history, access });
  } catch (err) {
    console.error("[billing/subscription] erro ao carregar", err);
    return NextResponse.json({ error: "Não foi possível carregar sua assinatura." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const parsed = cancelRenewalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const result = await cancelRenewal(userId, parsed.data.subscriptionId);

    if (!result.ok) {
      // 404 = a assinatura não é do usuário / não existe.
      // 502 = o gateway recusou: o cancelamento NÃO aconteceu e o banco local
      //       não foi tocado. Dizer "ok" aqui faria a tela mentir enquanto o
      //       Asaas seguiria cobrando.
      const status = result.reason === "not_found" ? 404 : 502;
      return NextResponse.json({ error: result.message, reason: result.reason }, { status });
    }

    return NextResponse.json({ ok: true, subscription: result.subscription });
  } catch (err) {
    console.error("[billing/subscription] erro ao cancelar renovação", err);
    return NextResponse.json({ error: "Erro ao cancelar renovação." }, { status: 500 });
  }
}
