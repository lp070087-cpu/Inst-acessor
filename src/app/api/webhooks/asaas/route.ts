import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
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
 *   - Token validado por comparação constante (`timingSafeEqual`) contra
 *     `ASAAS_WEBHOOK_TOKEN`. Fonte oficial: header `asaas-access-token`, que é
 *     onde o Asaas envia o `authToken` cadastrado no painel. Ausente/incorreto
 *     → 403. NUNCA por query string (`?token=` não é aceito).
 *   - O `authToken` do webhook NÃO é a API Key do Asaas. Ele deve ter entre
 *     32 e 255 caracteres e não conter espaços, e o MESMO valor precisa existir
 *     em Painel Asaas → Webhook → Token de autenticação e em
 *     Vercel → `ASAAS_WEBHOOK_TOKEN`.
 *   - Rate limit por IP (proteção contra flood).
 *   - Idempotência: `eventId` único em `BillingEvent` — replays NÃO reprocessam.
 *   - NUNCA confia em `userId`/preço/plano do payload: a ordem é localizada pela
 *     `externalReference` e o valor/duração/ciclo são validados no SERVIDOR.
 *   - Regra 13: `processed=true` só é marcado após efeito aplicado OU no-effect
 *     consciente; falha mantém `processed=false` (auditável/reprocessável).
 *   - Atualiza SOMENTE registros correspondentes; se não encontrar, registra o
 *     evento (payload sanitizado) e responde 200 rapidamente.
 *   - Payload persistido SEMPRE sanitizado (nunca tokens/secrets).
 *
 * Observação documentada: o Asaas autentica webhooks por TOKEN compartilhado
 * (header `asaas-access-token`), não por assinatura HMAC de payload.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Token do webhook — FONTE OFICIAL: header `asaas-access-token`.
 * É o header que o Asaas envia, carregando o `authToken` cadastrado no painel.
 * NÃO usamos a API Key como authToken e NÃO tratamos `Authorization: Bearer`
 * como método principal. Buscar apenas neste header é o que mantém a validação
 * estrita — qualquer outra via seria uma porta a mais sem necessidade.
 * Token por QUERY STRING é proibido (vaza em logs/proxies).
 */
function extractToken(request: Request): string | null {
  const header = request.headers.get("asaas-access-token");
  return header ? header.trim() : null;
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

  // 6) Processa o evento (idempotência por claim-first dentro de events.ts).
  //    - replay (processed:true) → 200 duplicate.
  //    - falha ao aplicar → 5xx para o Asaas REENVIAR (regra 13: falhas ficam
  //      reprocessáveis; processed permanece false).
  const { duplicate, failed } = await handleAsaasEvent(parsed);
  if (failed) {
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }

  // 7) Resposta rápida — o Asaas NÃO deve reenviar.
  return NextResponse.json({ received: true, duplicate }, { status: 200 });
}
