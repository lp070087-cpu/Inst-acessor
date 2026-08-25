import { NextResponse } from "next/server";

/**
 * Webhook do TikTok — preparado estruturalmente.
 *
 * GET  → valida o desafio de verificação do TikTok (echostr).
 * POST → recebe eventos do TikTok e prepara o processamento.
 *
 * ATENÇÃO:
 * - Não configurar URL falsa no portal do TikTok ainda — só ativar quando
 *   o webhook estiver pronto para receber eventos reais.
 * - Não logar tokens/credenciais.
 */

const VERIFY_TOKEN = process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN || "";

export async function GET(request: Request) {
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
  let payload: unknown;
  try {
    payload = await request.json();
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

  // TODO(Fase 3.5): enfileirar o processamento dos eventos.
  // Por ora, apenas reconhece e responde 200 para o TikTok não reenviar.
  return NextResponse.json({ received: true }, { status: 200 });
}
