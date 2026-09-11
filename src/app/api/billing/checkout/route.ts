import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { getPlanById } from "@/lib/billing/plans";
import { startPublicCheckout } from "@/lib/billing/asaas/checkout-order";
import { normalizeEmail } from "@/lib/first-access/core";
import { publicCheckoutSchema } from "@/lib/validators/billing";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout — checkout PÚBLICO (comprador NÃO precisa de conta)
 * =================================================================================
 * Fluxo oficial: landing → escolha do plano → este endpoint → checkout hospedado
 * do Asaas (POST /v3/checkouts) → webhook validado → AccessGrant → primeiro acesso.
 *
 * - Body MÍNIMO (público): { planSlug | planId, name?, email? }.
 * - NUNCA confia em preço/duração/ciclo vindos do browser: o plano é resolvido
 *   NO SERVIDOR (catálogo oficial) e é ele que define valor/duração/recorrência.
 * - Comprador AUTENTICADO: o e-mail/nome vêm da SESSÃO (fonte de verdade) e a
 *   ordem é vinculada ao User. `assinatura-client.tsx` chama com { planId }.
 * - Comprador ANÔNIMO: `email` é obrigatório e vira a identidade da ordem;
 *   quando o pagamento for confirmado o AccessGrant nasce por e-mail.
 * - CRIAR CHECKOUT ≠ PAGAMENTO: o acesso só é liberado por webhook VALIDADO.
 * - Sem `ASAAS_API_KEY` → estado controlado (nenhuma URL fake, nada cobrado).
 */
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getSession>> | null = null;
  try {
    session = await getSession();
  } catch {
    session = null; // ambiente sem sessão → segue como anônimo
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = publicCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  // 1) Identidade: sessão autenticada tem precedência (fonte de verdade).
  let userEmail = "";
  let userName: string | null = null;
  let userId: string | null = null;

  if (session?.user?.id && session.user.email) {
    userId = session.user.id;
    userEmail = session.user.email;
    userName = session.user.name ?? null;
  } else {
    const normalized = normalizeEmail(parsed.data.email ?? "");
    if (!normalized) {
      return NextResponse.json(
        { error: "Informe um e-mail válido para receber seu acesso." },
        { status: 400 }
      );
    }
    userEmail = normalized;
    userName = parsed.data.name ?? null;
  }

  // 2) Plano SEMPRE resolvido no servidor (id do banco ou `plan:<slug>`).
  const planRef = parsed.data.planId ?? parsed.data.planSlug ?? "";
  const plan = await getPlanById(planRef);
  if (!plan || !plan.active) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  // 3) Comprador anônimo cujo e-mail JÁ é um User nosso → vincula a ordem
  //    a esse User (renovação de quem já tem conta, mesmo sem sessão).
  if (!userId) {
    const existingUser = (await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    })) as unknown as { id: string } | null;
    if (existingUser) userId = existingUser.id;
  }

  const result = await startPublicCheckout({
    email: userEmail,
    name: userName,
    planId: plan.id,
    userId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        message: result.message,
        error: result.message,
        checkoutUrl: null,
      },
      { status: result.status === "INTEGRATION_NOT_CONFIGURED" ? 200 : 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    checkout: {
      status: result.status,
      message: result.message,
      planId: plan.id,
      planName: plan.name,
      priceCents: plan.priceCents,
      checkoutUrl: result.checkoutUrl,
      // Checkout hospedado ainda NÃO criou assinatura (o webhook cria quando o
      // pagamento for confirmado). Devolvemos a ordem local como referência
      // PENDING para a UI otimista de /assinatura.
      subscriptionId: result.order?.id ?? null,
      subscriptionStatus: "PENDING",
    },
  });
}
