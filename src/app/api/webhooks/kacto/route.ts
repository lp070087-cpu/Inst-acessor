import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { getGatewayConfig } from "@/lib/billing/gateways/config";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * KACTO — WEBHOOK STUB (PENDENTE)
 * ===============================
 * Endpoint FIXO por arquitetura: /api/webhooks/kacto
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
  return NextResponse.json({ ok: true, provider: "kacto", status: "pending", endpoint: "/api/webhooks/kacto" });
}

export async function POST(request: Request) {
  if (!webhookRateLimiter.check(clientIp(request))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  let enabled = false;
  try {
    const cfg = await getGatewayConfig();
    enabled = Boolean(cfg.gateways?.kacto?.enabled);
  } catch {
    enabled = false;
  }
  if (!enabled) {
    return NextResponse.json({ error: "Gateway Kacto não configurado." }, { status: 503 });
  }

  let payload: unknown = null;
  try {
    const raw = await request.text();
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const rawObj = payload as Record<string, unknown> | null;
  const maybeId =
    typeof rawObj?.order_id === "string" ? (rawObj.order_id as string) : typeof rawObj?.id === "string" ? (rawObj.id as string) : null;
  const maybePlan =
    typeof rawObj?.plan_slug === "string"
      ? (rawObj.plan_slug as string)
      : typeof rawObj?.product_slug === "string"
        ? (rawObj.product_slug as string)
        : null;

  if (maybePlan && !isValidPlanSlug(maybePlan)) {
    console.warn("[kacto-webhook] plan_slug inválido", maybePlan);
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  if (maybeId) {
    const eventId = `kacto:${maybeId}`;
    try {
      const { bll } = await import("@/lib/billing/db");
      const existing = (await bll.billingEvent.findUnique({ where: { eventId } })) as unknown as { id: string } | null;
      if (existing) {
        return NextResponse.json({ received: true, duplicate: true, pending: true }, { status: 200 });
      }
      await bll.billingEvent.create({
        data: {
          eventId,
          provider: "kacto",
          type: "PENDING_INTEGRATION",
          userId: null,
          subscriptionId: null,
          payload: sanitizePayload(payload),
          processed: false,
        },
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json(
    {
      error: "Integração Kacto pendente — credenciais não configuradas. Documentação de assinatura/token ainda não confirmada.",
      pending: true,
      provider: "kacto",
    },
    { status: 501 }
  );
}
