import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

/**
 * Webhook do Instagram (Meta) — preparado estruturalmente.
 *
 * GET  → valida o challenge de verificação da Meta (hub.mode/hub.verify_token/hub.challenge).
 * POST → recebe eventos do Instagram e prepara o processamento.
 *
 * ATENÇÃO:
 * - Não configurar URL falsa no painel da Meta ainda — só ativar quando
 *   o webhook estiver pronto para receber eventos reais.
 * - Não logar tokens/credenciais.
 */

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Valida o challenge da Meta.
  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.info("[instagram-webhook] challenge verificado pela Meta");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    `[instagram-webhook] challenge inválido (mode=${mode} token=${
      token === VERIFY_TOKEN ? "ok" : "errado"
    })`
  );
  return new NextResponse("Verificação falhou", { status: 403 });
}

export async function POST(request: Request) {
  // Proteção básica contra flood de eventos.
  if (!webhookRateLimiter.check(clientIp(request))) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }

  // TODO(Fase 3): assinatura X-Hub-Signature-256 com App Secret.
  // Por enquanto validamos apenas a forma do payload.

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // Estrutura esperada da Meta:
  // { object: "instagram", entry: [{ id, time, changes: [...] }] }
  if (!isInstagramPayload(payload)) {
    console.warn("[instagram-webhook] payload fora do formato esperado");
    return new NextResponse("Payload inválido", { status: 400 });
  }

  const object = (payload as { object: string }).object;
  const entries = (payload as { entry: unknown[] }).entry;

  console.info(
    `[instagram-webhook] evento recebido object=${object} entries=${entries.length}`
  );

  // TODO(Fase 3): enfileirar o processamento dos eventos
  // (ex.: atualizar métricas da conta afetada).
  // Por ora, apenas reconhece e responde 200 para a Meta não reenviar.

  return NextResponse.json({ received: true }, { status: 200 });
}

function isInstagramPayload(value: unknown): value is {
  object: string;
  entry: unknown[];
} {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.object === "instagram" && Array.isArray(obj.entry);
}
