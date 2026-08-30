import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhooks/signature";

/**
 * Webhook do TikTok — arquitetura segura.
 *
 * GET  → valida o desafio de verificação do TikTok (echostr/token).
 * POST → recebe eventos do TikTok com:
 *        - Fail-closed: sem `TIKTOK_CLIENT_SECRET` → 503 (não finge receber).
 *        - Verificação de origem via header `X-Signature`
 *          (HMAC-SHA256 com `TIKTOK_CLIENT_SECRET` — mesmo padrão Meta).
 *        - Rate limit por IP (proteção contra flood).
 *        - Nada é executado automaticamente — apenas reconhecido.
 *
 * ATENÇÃO:
 * - Não configurar URL falsa no portal do TikTok ainda — só ativar quando o
 *   webhook estiver pronto para receber eventos reais.
 * - Não logar tokens/credenciais.
 */

const VERIFY_TOKEN = process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN || "";
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "";

const CONFIGURED = Boolean(VERIFY_TOKEN && CLIENT_SECRET);

export async function GET(request: Request) {
  // Não configurado → não aceita challenges (nada a validar).
  if (!CONFIGURED) {
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  const url = new URL(request.url);
  const echostr = url.searchParams.get("echostr");
  const token = url.searchParams.get("token");

  // TikTok envia `echostr` como desafio de verificação.
  if (token === VERIFY_TOKEN && echostr) {
    console.info("[tiktok-webhook] challenge verificado pelo TikTok");
    return new NextResponse(echostr, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    `[tiktok-webhook] challenge inválido (token=${token === VERIFY_TOKEN ? "ok" : "errado"})`
  );
  return new NextResponse("Verificação falhou", { status: 403 });
}

export async function POST(request: Request) {
  // Fail-closed: sem client secret não há como confirmar a origem do evento.
  if (!CONFIGURED) {
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // 1) Proteção básica contra flood de eventos.
  if (!webhookRateLimiter.check(clientIp(request))) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }

  // 2) Verificação de origem: assinatura X-Signature (HMAC-SHA256).
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  if (!verifyWebhookSignature(rawBody, signature, CLIENT_SECRET)) {
    console.warn("[tiktok-webhook] assinatura inválida — evento ignorado");
    return new NextResponse("Assinatura inválida", { status: 403 });
  }

  // 3) Parse do payload (após validar assinatura).
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // 4) Estrutura esperada do TikTok:
  // { event: "PublishVideo", ... }
  if (typeof payload !== "object" || payload === null || !("event" in payload)) {
    console.warn("[tiktok-webhook] payload fora do formato esperado");
    return new NextResponse("Payload inválido", { status: 400 });
  }

  console.info(
    `[tiktok-webhook] evento recebido event=${(payload as { event: string }).event}`
  );

  // TODO(Fase 3.5): enfileirar o processamento dos eventos.
  // Por ora, apenas reconhece e responde 200 para o TikTok não reenviar.
  return NextResponse.json({ received: true }, { status: 200 });
}
