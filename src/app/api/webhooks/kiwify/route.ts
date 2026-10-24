import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { getGatewayConfig } from "@/lib/billing/gateways/config";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KIWIFY — WEBHOOK STUB (PENDENTE)
 * ================================
 * Endpoint FIXO por arquitetura: /api/webhooks/kiwify
 * NUNCA derivado de input do usuário. Não redireciona. Não loga segredos.
 *
 * Estado: 501 — integração pendente. Quando credenciais forem definidas e a
 * documentação oficial de assinatura/token for confirmada, este handler passa a:
 *   1. verificar assinatura/token (server-only, timing-safe)
 *   2. parsear payload com validação de plano (PLAN_CATALOG)
 *   3. idempotência por BillingEvent.eventId (claim-first)
 *   4. grant de acesso somente após validação server-side (nunca amount do payload)
 */

function isValidPlanSlug(slug: string): boolean {
  return PLAN_CATALOG.some((p) => p.slug === slug);
}

function sanitizePayload(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizePayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|access_|apikey|api_key|authorization|signature|hmac/i.test(k)) continue;
    out[k] = typeof v === "object" && v !== null ? sanitizePayload(v) : v;
  }
  return out;
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "kiwify", status: "pending", endpoint: "/api/webhooks/kiwify" });
}

export async function POST(request: Request) {
  if (!webhookRateLimiter.check(clientIp(request))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  // 1) Gate: gateway precisa estar habilitado em billing.gateways
  let enabled = false;
  try {
    const cfg = await getGatewayConfig();
    enabled = Boolean(cfg.gateways?.kiwify?.enabled);
  } catch {
    enabled = false;
  }
  if (!enabled) {
    return NextResponse.json({ error: "Gateway Kiwify não configurado." }, { status: 503 });
  }

  // 2) Integração ainda pendente — credenciais e verificação de assinatura não confirmadas.
  //    Não processa: registra intenção e retorna 501 explícito.
  let payload: unknown = null;
  try {
    const raw = await request.text();
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Idempotência: se houver eventId deduzível, verifica duplicidade antes de gravar.
  // (BillingEvent.provider = "kiwify", eventId determinístico quando possível)
  const rawObj = payload as Record<string, unknown> | null;
  const maybeId =
    typeof rawObj?.order_id === "string" ? (rawObj.order_id as string) : typeof rawObj?.id === "string" ? (rawObj.id as string) : null;
  const maybePlan =
    typeof rawObj?.plan_slug === "string"
      ? (rawObj.plan_slug as string)
      : typeof rawObj?.product_slug === "string"
        ? (rawObj.product_slug as string)
        : null;

  // Validação de plano quando deduzível — nunca libera acesso por slug inválido.
  if (maybePlan && !isValidPlanSlug(maybePlan)) {
    console.warn("[kiwify-webhook] plan_slug inválido", maybePlan);
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  // Persistência auditável (sem segredos): registra recebimento para idempotência futura.
  if (maybeId) {
    const eventId = `kiwify:${maybeId}`;
    try {
      const { bll } = await import("@/lib/billing/db");
      const existing = (await bll.billingEvent.findUnique({ where: { eventId } })) as unknown as { id: string } | null;
      if (existing) {
        return NextResponse.json({ received: true, duplicate: true, pending: true }, { status: 200 });
      }
      await bll.billingEvent.create({
        data: {
          eventId,
          provider: "kiwify",
          type: "PENDING_INTEGRATION",
          userId: null,
          subscriptionId: null,
          payload: sanitizePayload(payload),
          processed: false,
        },
      });
    } catch {
      // best-effort — não derruba a resposta
    }
  }

  // 3) PENDING — não concede acesso. Amount do payload é registrado, nunca confiado para grant.
  return NextResponse.json(
    {
      error: "Integração Kiwify pendente — credenciais não configuradas. Documentação de assinatura/token ainda não confirmada.",
      pending: true,
      provider: "kiwify",
    },
    { status: 501 }
  );
}
