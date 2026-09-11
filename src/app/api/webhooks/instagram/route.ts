import { NextResponse } from "next/server";

import { webhookRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { pub } from "@/lib/publishing/db";
import { verifyWebhookSignature } from "@/lib/webhooks/signature";
import { getWebhookAppSecret } from "@/lib/integrations/instagram/client";

/**
 * Webhook do Instagram (Meta) — arquitetura segura.
 *
 * GET  → valida o challenge de verificação da Meta (hub.mode/hub.verify_token/hub.challenge).
 *        O GET depende APENAS do verify token — o App Secret NÃO interfere.
 *        Sem params `hub.*` → diagnóstico seguro `{ok, provider, verifyTokenConfigured,
 *        appSecretConfigured}` (nunca expõe token/secret — só booleans).
 * POST → recebe eventos do Instagram com:
 *        - Verificação de origem via `X-Hub-Signature-256` (HMAC-SHA256 com o App Secret).
 *        - Idempotência por evento (AutomationEvent.eventId @@unique).
 *        - Sanitização de payload (nunca persiste tokens/secrets).
 *        - Rate limit por IP (proteção contra flood).
 *
 * `.trim()` nos envs: evita que espaços/CRLF quebrem a comparação exata do token.
 * Quando o webhook NÃO está configurado, NÃO finge receber eventos: 503/404.
 * Nada é executado automaticamente — apenas registrado.
 */

const VERIFY_TOKEN = (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "").trim();
// Prioridade do novo app: INSTAGRAM_APP_SECRET → META_APP_SECRET (compat).
const APP_SECRET = getWebhookAppSecret();

// GET (desafio da Meta) depende apenas do verify token.
const GET_CONFIGURED = Boolean(VERIFY_TOKEN);
// POST (eventos reais) depende de ambos: sem app secret não há assinatura a validar.
const CONFIGURED = Boolean(VERIFY_TOKEN && APP_SECRET);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Chamada real da Meta para verificar o webhook (sempre inclui hub.mode).
  if (mode) {
    if (!GET_CONFIGURED) {
      return new NextResponse("Webhook não configurado", { status: 503 });
    }
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      console.info("[instagram-webhook] challenge verificado pela Meta");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    console.warn(`[instagram-webhook] challenge inválido (mode=${mode})`);
    return new NextResponse("Verificação falhou", { status: 403 });
  }

  // Diagnóstico seguro (sem params hub.*): só booleans de configuração.
  // Nunca revela o token — nem tamanho, prefixo, sufixo, hash ou secret.
  return NextResponse.json({
    ok: true,
    provider: "Instagram",
    verifyTokenConfigured: GET_CONFIGURED,
    appSecretConfigured: Boolean(APP_SECRET),
  });
}

export async function POST(request: Request) {
  // Não configurado → não recebe eventos reais.
  if (!CONFIGURED) {
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // 1) Proteção básica contra flood de eventos.
  if (!webhookRateLimiter.check(clientIp(request))) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }

  // 2) Verificação de origem: assinatura X-Hub-Signature-256.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature, APP_SECRET)) {
    console.warn("[instagram-webhook] assinatura inválida — evento ignorado");
    return new NextResponse("Assinatura inválida", { status: 403 });
  }

  // 3) Parse do payload (após validar assinatura).
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // 4) Formato esperado da Meta: { object: "instagram", entry: [...] }.
  const event = extractInstagramEvent(payload);
  if (!event.eventId) {
    console.warn("[instagram-webhook] payload fora do formato esperado");
    return new NextResponse("Payload inválido", { status: 400 });
  }

  // 5) Idempotência: evento já processado não é re-processado.
  const existing = await pub.automationEvent.findUnique({
    where: { eventId: event.eventId },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  // 6) Persiste o evento (payload sanitizado — sem tokens/secrets).
  await pub.automationEvent.create({
    data: {
      userId: event.userId ?? "unknown",
      eventId: event.eventId,
      platform: "instagram",
      type: event.type ?? "instagram",
      payload: sanitizePayload(event.payload),
      processed: false,
    },
  });

  // 7) Nenhuma ação automática é executada nesta fase — apenas registro.
  //    (Futuramente: avaliar regras de automação e disparar com confirmação.)

  return NextResponse.json({ received: true }, { status: 200 });
}

/** Extrai um evento do payload do Instagram (Meta). */
function extractInstagramEvent(value: unknown): {
  eventId?: string;
  userId?: string;
  type?: string;
  payload?: unknown;
} {
  if (typeof value !== "object" || value === null) return {};
  const obj = value as Record<string, unknown>;
  if (obj.object !== "instagram" || !Array.isArray(obj.entry)) return {};

  const entry = obj.entry[0] as Record<string, unknown> | undefined;
  const id = typeof entry?.id === "string" ? entry.id : undefined;

  // userId quando o payload identifica a conta afetada (campo comum: id da página/IG).
  const changes = Array.isArray(entry?.changes) ? entry.changes : undefined;
  const firstChange = (Array.isArray(changes) ? changes[0] : undefined) as
    | Record<string, unknown>
    | undefined;

  return {
    eventId: id ? `instagram:${id}` : undefined,
    userId: typeof entry?.id === "string" ? entry.id : undefined,
    type: typeof firstChange?.field === "string" ? firstChange.field : "instagram",
    payload: obj,
  };
}

/** Remove chaves sensíveis conhecidas do payload antes de persistir. */
function sanitizePayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (/token|secret|password|access_|signature/i.test(k)) continue;
    if (k === "payload") continue; // evitar aninhamento não confiável
    out[k] = typeof v === "object" && v !== null ? sanitizePayload(v) : v;
  }
  return out;
}
