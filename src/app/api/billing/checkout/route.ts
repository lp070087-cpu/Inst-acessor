import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { startCheckout } from "@/lib/billing/checkout";
import { checkoutStartSchema } from "@/lib/validators/billing";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout — inicia o checkout de um plano (Asaas real).
 * Requer sessão + Zod.
 *
 * - O preço/duração/ciclo são resolvidos NO SERVIDOR (nunca do browser).
 * - O email/nome vêm da SESSÃO autenticada (nunca do body).
 * - Sem `ASAAS_API_KEY` → estado controlado "Pagamento online em configuração."
 * - Com gateway → cria cobrança/assinatura no Asaas e devolve URL/estado.
 * - CRIAR CHECKOUT NÃO libera acesso: o acesso só é ativado pelo webhook
 *   quando o pagamento for confirmado.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Email/nome sempre da FONTE DE VERDADE (banco) via sessão autenticada —
    // nunca do body. Usado apenas para criar o customer no Asaas.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 });
    }
    const userEmail = user.email ?? "";
    const userName = user.name ?? null;

    const body = await request.json();
    const parsed = checkoutStartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const result = await startCheckout({
      userId,
      userEmail,
      userName,
      planId: parsed.data.planId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          message: result.message,
          checkoutUrl: null,
        },
        { status: result.status === "INTEGRATION_NOT_CONFIGURED" ? 200 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkout: {
        status: result.status,
        message: result.message,
        planId: result.planId,
        planName: result.planName,
        priceCents: result.priceCents,
        checkoutUrl: result.checkoutUrl,
        subscriptionId: result.subscriptionId,
        subscriptionStatus: result.subscriptionStatus,
      },
    });
  } catch (err) {
    console.error("[billing/checkout] erro ao iniciar checkout", err);
    return NextResponse.json({ error: "Erro ao iniciar o checkout." }, { status: 500 });
  }
}
