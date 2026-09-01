import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { parseInfinitePayWebhook } from "@/lib/billing/infinitepay/webhook";
import { handleInfinitePayEvent } from "@/lib/billing/infinitepay/events";
import { getInfinitePayConfig } from "@/lib/billing/infinitepay/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * INFINITEPAY — WEBHOOK (server-only)
 * ====================================
 * Recebe notificações de pagamento do checkout InfinitePay.
 *
 * URL de produção (oficial):
 *   https://inst-acessor.vercel.app/api/webhooks/infinitepay
 *
 * Segurança (fail-closed):
 *   - NUNCA concede acesso apenas porque um POST chegou. A liberação depende de:
 *       (a) payload válido com referência estável (order_nsu/transaction_nsu);
 *       (b) dono localizado pela referência externa no banco;
 *       (c) plano/valor conferido contra o catálogo oficial;
 *       (d) `payment_check` REAL no InfinitePay respondendo "pago" (quando a
 *           chave de confirmação estiver configurada). Sem chave, o evento é
 *           registrado como `pending_confirmation` e NENHUM acesso é liberado.
 *   - Autenticação HMAC/token: NÃO é inventada. Se a documentação oficial do
 *     InfinitePay comprovar um mecanismo, ele será adicionado aqui. Sem prova,
 *     o webhook valida apenas o formato + refs + confirmação server-side.
 *   - Idempotência: `eventId` determinístico (transaction/order nsu) em
 *     `BillingEvent` — replays NÃO reprocessam.
 *   - Rate limit por IP (proteção contra flood).
 *   - Resposta rápida (<1s): o provedor não deve ficar reenviando.
 *
 * Respostas:
 *   - 400 payload inválido (JSON malformado / sem referência estável).
 *   - 200 evento válido (processado ou duplicado).
 */

export async function GET() {
  // Health check público — sem segredos.
  return NextResponse.json({
    ok: true,
    provider: "InfinitePay",
    endpoint: "webhook",
  });
}

export async function POST(request: Request) {
  // 1) Rate limit por IP.
  if (!webhookRateLimiter.check(clientIp(request))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  // 2) Corpo bruto → JSON.
  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // 3) Parse e validação (formato + referência estável).
  const parsed = parseInfinitePayWebhook(payload);
  if (!parsed) {
    console.warn("[infinitepay-webhook] payload sem referência estável");
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // 4) Idempotência: evento já processado → reconhece sem reprocessar.
  const { bll } = await import("@/lib/billing/db");
  const existing = (await bll.billingEvent.findUnique({
    where: { eventId: parsed.eventId },
  })) as unknown as { id: string } | null;
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  // 5) Confirmação de configuração (sem revelar valores).
  const cfg = getInfinitePayConfig();
  const confirmationAvailable = Boolean(cfg.apiKey);

  // 6) Processa o evento (localiza dono, confere plano/valor, confirmação
  //    server-side quando aplicável, libera acesso somente se confirmado).
  const { duplicate, granted, confirmation } = await handleInfinitePayEvent(parsed);

  // 7) Resposta rápida — o provedor NÃO deve reenviar.
  return NextResponse.json(
    {
      received: true,
      duplicate,
      confirmation,
      granted,
      confirmationAvailable,
    },
    { status: 200 }
  );
}
