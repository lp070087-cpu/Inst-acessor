import { NextResponse } from "next/server";
import { dbRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

import {
  getTikTokWebhookSecret,
  verifyTikTokSignature,
  type TikTokSignatureReason,
} from "@/lib/webhooks/signature";

/**
 * Webhook do TikTok — preparado estruturalmente.
 *
 * GET  → valida o desafio de verificação do TikTok (echostr).
 * POST → verifica a ASSINATURA HMAC (`TikTok-Signature`) sobre o corpo bruto e,
 *        só então, reconhece o evento.
 *
 * ATENÇÃO:
 * - Não configurar URL falsa no portal do TikTok ainda — só ativar quando
 *   o webhook estiver pronto para receber eventos reais.
 * - Não logar tokens/credenciais.
 */

/**
 * Lido por requisição (e não no escopo do módulo): em serverless o valor do
 * ambiente pode não existir quando o bundle é avaliado.
 */
function configuredVerifyToken(): string {
  return (process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN ?? "").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const echostr = url.searchParams.get("echostr");
  const token = (url.searchParams.get("token") ?? "").trim();

  const expected = configuredVerifyToken();

  // FAIL-CLOSED: sem token configurado NÃO há como provar que a chamada é do
  // TikTok. Antes, `token === VERIFY_TOKEN` com ambos vazios (`"" === ""`)
  // liberava o challenge para qualquer chamador — o mesmo defeito já corrigido
  // no webhook do Instagram.
  if (!expected) {
    console.error(
      "[tiktok-webhook] TIKTOK_WEBHOOK_VERIFY_TOKEN não configurado — challenge recusado"
    );
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // TikTok envia `echostr` como desafio de verificação.
  if (token && token === expected && echostr) {
    console.info("[tiktok-webhook] challenge verificado pelo TikTok");
    return new NextResponse(echostr, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    `[tiktok-webhook] challenge inválido (token=${token ? "não confere" : "ausente"})`
  );
  return new NextResponse("Verificação falhou", { status: 403 });
}

/** Mensagem de log por motivo de recusa — nunca inclui a assinatura recebida. */
const TIKTOK_REJECTION_LOG: Record<TikTokSignatureReason, string> = {
  missing_secret: "segredo do webhook ausente — assinatura não verificável",
  missing_header: "header TikTok-Signature ausente",
  malformed_header: "header TikTok-Signature malformado",
  stale_timestamp: "timestamp da assinatura fora da janela (replay recusado)",
  invalid_signature: "assinatura não confere",
};

export async function POST(request: Request) {
  // FAIL-CLOSED: enquanto o webhook não estiver configurado, nenhum evento é
  // processado. Evita aceitar payloads não autenticados quando a Fase 3.5
  // passar a agir sobre eles.
  if (!configuredVerifyToken()) {
    console.error("[tiktok-webhook] webhook não configurado — evento recusado");
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // O corpo bruto é lido ANTES do parse: a assinatura é calculada sobre os
  // BYTES EXATOS recebidos (um parse+reserialize alteraria espaços/ordem e
  // invalidaria a assinatura).
  const rawBody = await request.text();

  // ---- ASSINATURA (`TikTok-Signature`, formato `t=...,s=...`) ----
  // Ordem obrigatória: segredo → header → assinatura, TUDO antes do JSON.parse.
  // FAIL-CLOSED em cada etapa: sem segredo, sem header, header malformado,
  // timestamp antigo (replay) ou assinatura divergente → recusa.
  //
  // NENHUM destes passos compara strings "crus": a comparação é
  // `timingSafeEqual`, e a assinatura/segredo NUNCA entram em log.
  const secret = getTikTokWebhookSecret();
  const signatureHeader = request.headers.get("TikTok-Signature");
  const verdict = verifyTikTokSignature(rawBody, signatureHeader, secret);
  if (!verdict.ok) {
    const reason = verdict.reason ?? "invalid_signature";
    console.warn(`[tiktok-webhook] assinatura recusada (${TIKTOK_REJECTION_LOG[reason]})`);
    // Sem segredo é 503 (configuração ausente, como o Instagram faz); qualquer
    // outra recusa é 403 (origem não provada).
    const status = reason === "missing_secret" ? 503 : 403;
    return new NextResponse("Assinatura inválida", { status });
  }

  if (!(await dbRateLimiter.check(`tiktok-webhook:${clientIp(request)}`, { windowMs: 60_000, max: 120 }))) {
    return new NextResponse("Entrega temporariamente limitada", { status: 429 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // Estrutura esperada do TikTok:
  // { event: "PublishVideo", ... }
  if (typeof payload !== "object" || payload === null || !("event" in payload)) {
    console.warn("[tiktok-webhook] payload fora do formato esperado");
    return new NextResponse("Payload inválido", { status: 400 });
  }

  console.info(
    `[tiktok-webhook] evento recebido event=${(payload as { event: string }).event}`
  );

  // Do not acknowledge events that have not been durably processed.
  return NextResponse.json({ received: false, status: "PROCESSING_NOT_AVAILABLE" }, { status: 503 });
}
