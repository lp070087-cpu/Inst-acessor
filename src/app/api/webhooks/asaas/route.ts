import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { bll } from "@/lib/billing/db";
import { getAsaasConfig } from "@/lib/billing/asaas/config";
import { parseAsaasWebhook } from "@/lib/billing/asaas/webhook";
import { handleAsaasEvent } from "@/lib/billing/asaas/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ASAAS — WEBHOOK (server-only)
 * ==============================
 * Recebe eventos confirmados do Asaas (payment/subscription).
 *
 * Segurança (fail-closed):
 *   - Sem `ASAAS_WEBHOOK_TOKEN` → 503 (webhook não configurado; NÃO aceita nada).
 *   - Token validado por comparação constante (timingSafeEqual). Fontes aceitas
 *     (nesta ordem): header `asaas-access-token` (forma oficial do Asaas),
 *     `Authorization: Bearer`, query `?token=`. Ausente/incorreto → 403.
 *   - Rate limit por IP (proteção contra flood).
 *   - Idempotência: `eventId` único em `BillingEvent` — replays NÃO reprocessam.
 *   - NUNCA confia em `userId` do payload: o dono é localizado pela referência
 *     externa (customer/subscription/payment id) no banco.
 *   - Atualiza SOMENTE registros correspondentes; se não encontrar, registra o
 *     evento (payload sanitizado) e responde 200 rapidamente.
 *   - Payload persistido SEMPRE sanitizado (nunca tokens/secrets).
 *
 * Observação documentada: o Asaas autentica webhooks por TOKEN (header
 * `asaas-access-token`), não por assinatura HMAC de payload. O nome EXATO do
 * header/campo deve ser confirmado na documentação oficial ao habilitar.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function extractToken(request: Request): string | null {
  const header = request.headers.get("asaas-access-token");
  if (header) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("token");
    if (q) return q.trim();
  } catch {
    /* URL inválida → sem token */
  }
  return null;
}

export async function POST(request: Request) {
  // 1) Fail-closed: sem token configurado → não aceita eventos.
  const cfg = getAsaasConfig();
  if (!cfg.webhookToken) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  // 2) Rate limit por IP.
  if (!webhookRateLimiter.check(clientIp(request))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  // 3) Token (comparação constante).
  const token = extractToken(request);
  if (!token || !safeEqual(token, cfg.webhookToken)) {
    console.warn("[asaas-webhook] token inválido ou ausente — evento ignorado");
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  // 4) Corpo bruto → JSON.
  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // 5) Parse e validação de evento conhecido.
  const parsed = parseAsaasWebhook(payload);
  if (!parsed) {
    console.warn("[asaas-webhook] evento desconhecido ou payload sem referência estável");
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // 6) Idempotência: evento já processado → reconhece sem reprocessar.
  const existing = (await bll.billingEvent.findUnique({
    where: { eventId: parsed.eventId },
  })) as unknown as { id: string } | null;
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  // 7) Processa o evento (localiza dono por referência externa, atualiza
  //    somente registros correspondentes, persiste evento sanitizado).
  const { duplicate } = await handleAsaasEvent(parsed);

  // 8) Resposta rápida — o Asaas NÃO deve reenviar.
  return NextResponse.json({ received: true, duplicate }, { status: 200 });
}
