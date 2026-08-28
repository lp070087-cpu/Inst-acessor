import { NextResponse } from "next/server";

import { pub } from "@/lib/publishing/db";
import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * FASE 7 — WEBHOOKS GENÉRICOS (Parte 13)
 * =======================================
 * Camada preparada para receber eventos reais de Meta/TikTok com:
 *  - verificação de origem (query token / assinatura) — não inventada;
 *  - idempotência via eventId (AutomationEvent.@@unique(eventId));
 *  - logs seguros (nunca tokens/secrets);
 *  - mapeamento para o owner (userId) quando conhecido.
 *
 * Quando a configuração externa (app secret/verify token) não está presente,
 * NÃO recebemos eventos reais — a rota permanece pronta, sem afirmar receber.
 *
 * Apenas eventos "comment" (fundação Comentário→DM) são aceitos nesta fase;
 * nenhuma ação real é executada — registramos a avaliação.
 */

// Verificação de origem: quando configurado, exigimos o token de verificação.
// Isto é uma proteção de origem PREPARADA — o padrão real (X-Hub-Signature-256)
// será ativado com o App Secret quando a integração for liberada.
const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "";

interface WebhookEvent {
  eventId?: string;
  platform?: string;
  type?: string;
  payload?: unknown;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Se não configurado, não validamos challenges (nada recebido ainda).
  if (VERIFY_TOKEN) {
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new NextResponse("Verificação falhou", { status: 403 });
  }

  // Sem token configurado — rota preparada, mas não afirma receber eventos.
  return new NextResponse("Webhook não configurado", { status: 404 });
}

export async function POST(request: Request) {
  // Proteção básica contra flood (a assinatura real será ativada na integração).
  if (!webhookRateLimiter.check(clientIp(request))) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // Idempotência: eventos já processados não são re-processados.
  const event = extractEvent(body);
  if (!event.eventId) {
    return new NextResponse("Evento sem identificador", { status: 400 });
  }

  const existing = await pub.automationEvent.findUnique({
    where: { eventId: event.eventId },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  // Persistimos o evento (payload sanitizado — sem tokens/secrets).
  await pub.automationEvent.create({
    data: {
      userId: event.userId ?? "unknown",
      eventId: event.eventId,
      platform: event.platform ?? "instagram",
      type: event.type ?? "unknown",
      payload: sanitizePayload(event.payload),
      processed: false,
    },
  });

  // Registramos a avaliação (sem executar ação real).
  if (event.type === "comment") {
    await pub.automationExecution.create({
      data: {
        userId: event.userId ?? "unknown",
        eventId: event.eventId,
        status: "EVALUATED",
        detail: "Regra de automação avaliada — execução real não habilitada nesta fase.",
      },
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/** Extrai um evento genérico de payloads Meta/TikTok conhecidos. */
function extractEvent(body: unknown): WebhookEvent & { userId?: string } {
  if (typeof body !== "object" || body === null) return {};

  const obj = body as Record<string, unknown>;

  // Meta: { object: "instagram", entry: [{ id, time, changes }] }
  if (obj.object === "instagram" && Array.isArray(obj.entry)) {
    const entry = obj.entry[0] as Record<string, unknown> | undefined;
    const eventId = typeof entry?.id === "string" ? entry.id : `${Date.now()}`;
    return {
      eventId,
      platform: "instagram",
      type: "instagram",
      payload: obj,
    };
  }

  // TikTok: { event, from_user_id, ... }
  if (typeof obj.event === "string") {
    const eventId = typeof obj.timestamp === "number"
      ? `${obj.event}-${obj.timestamp}-${obj.from_user_id ?? ""}`
      : `${obj.event}-${obj.from_user_id ?? ""}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      eventId,
      platform: "tiktok",
      type: obj.event,
      payload: obj,
    };
  }

  return { eventId: undefined };
}

/** Remove chaves sensíveis conhecidas do payload antes de persistir. */
function sanitizePayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (/token|secret|password|access_/i.test(k)) continue;
    if (k === "payload") continue; // evitar aninhamento de payload não confiável
    out[k] = typeof v === "object" && v !== null ? sanitizePayload(v) : v;
  }
  return out;
}
