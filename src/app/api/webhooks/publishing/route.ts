import { NextResponse } from "next/server";
import { createHash } from "crypto";

import { pub } from "@/lib/publishing/db";
import { webhookRateLimiter, dbRateLimiter, clientIp } from "@/lib/publishing/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhooks/signature";
import { getWebhookAppSecret } from "@/lib/integrations/instagram/client";

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
 * Esta rota NÃO avalia regra de automação: ela é um receptáculo genérico que
 * não resolve a conta do usuário nem carrega o motor Comentário → Direct (que
 * vive no webhook do Instagram, `api/webhooks/instagram`, sobre `CommentDirectRule`).
 * Por isso o log de execução é registrado como NÃO AVALIADO — nunca como se a
 * regra tivesse sido avaliada (o antigo status "EVALUATED" era fictício).
 */

// Verificação de origem: challenge GET usa o verify token; o POST assinado
// usa o App Secret (X-Hub-Signature-256) quando configurado.
// `.trim()` nos envs: espaços/CRLF acidentais quebrariam a comparação exata
// do token no GET (causa real de 403 "Verificação falhou" com token válido).
const VERIFY_TOKEN = (process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "").trim();
// Prioridade do novo app: INSTAGRAM_APP_SECRET → META_APP_SECRET (compat).
const APP_SECRET = getWebhookAppSecret();
const CONFIGURED = Boolean(VERIFY_TOKEN);

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
  // Não configurado → não recebe eventos reais.
  if (!CONFIGURED) {
    return new NextResponse("Webhook não configurado", { status: 503 });
  }

  // Proteção contra flood com DUAS camadas:
  //  1. in-memory (barata, por instância — ver a limitação documentada em
  //     `@/lib/publishing/rate-limit`);
  //  2. contador PERSISTENTE em DB, COMPARTILHADO por todas as instâncias — o
  //     único que de fato segura uma enxurrada vinda de várias instâncias.
  // A defesa PRINCIPAL contra origem falsa continua sendo a assinatura HMAC
  // (abaixo), fail-closed quando o App Secret existe.
  const ip = clientIp(request);
  if (!webhookRateLimiter.check(ip)) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }
  const ipAllowed = await dbRateLimiter.check(`webhook:${ip}`, {
    windowMs: 60_000,
    max: 120,
  });
  if (!ipAllowed) {
    return new NextResponse("Muitas requisições", { status: 429 });
  }

  // Verificação de origem: quando o App Secret está configurado, exigimos a
  // assinatura X-Hub-Signature-256 (padrão Meta). Sem App Secret, aceitamos
  // apenas payloads com challenge previamente validado — protegido por rate limit.
  const rawBody = await request.text();
  if (APP_SECRET) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyWebhookSignature(rawBody, signature, APP_SECRET)) {
      console.warn("[publishing-webhook] assinatura inválida — evento ignorado");
      return new NextResponse("Assinatura inválida", { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
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

  // Registramos o recebimento, HONESTAMENTE: esta rota NÃO avalia regra de
  // automação (não resolve o usuário nem roda o motor). O log diz exatamente
  // isso — o antigo "EVALUATED" implicava uma avaliação que não acontece.
  await pub.automationExecution.create({
    data: {
      userId: event.userId ?? "unknown",
      eventId: event.eventId,
      status: "RECEIVED",
      detail: "Evento recebido por um webhook genérico — nenhuma regra de automação é avaliada nesta rota.",
    },
  });

  return NextResponse.json({ received: true }, { status: 200 });
}

/** Hash estável e curto de um payload — usado quando não há id natural. */
function payloadFingerprint(body: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(body) ?? "";
  } catch {
    serialized = "unserializable";
  }
  return createHash("sha256").update(serialized).digest("hex").slice(0, 32);
}

/** Extrai um evento genérico de payloads Meta/TikTok conhecidos. */
function extractEvent(body: unknown): WebhookEvent & { userId?: string } {
  if (typeof body !== "object" || body === null) return {};

  const obj = body as Record<string, unknown>;

  // Meta: { object: "instagram", entry: [{ id, time, changes }] }
  if (obj.object === "instagram" && Array.isArray(obj.entry)) {
    const entry = obj.entry[0] as Record<string, unknown> | undefined;
    const entryId = typeof entry?.id === "string" ? entry.id : null;
    const time = entry && typeof entry.time === "number" ? entry.time : null;
    // IDENTIFICADOR DETERMINÍSTICO: `entry.id` + `time` identificam a entrega.
    // Sem eles (a Meta não garante ambos), usa-se o hash SHA-256 do payload —
    // ESTÁVEL para o mesmo corpo e SEM reentrega falsa. Nunca `Date.now()` nem
    // `Math.random()`, que davam um id novo (e quebravam a idempotência) a cada
    // reentrega do MESMO evento.
    const eventId = entryId
      ? `instagram:${entryId}:${time ?? payloadFingerprint(entry)}`
      : `instagram:sha256:${payloadFingerprint(obj)}`;
    return {
      eventId,
      platform: "instagram",
      type: "instagram",
      payload: obj,
    };
  }

  // TikTok: { event, from_user_id, ... }
  if (typeof obj.event === "string") {
    // Mesma regra: campos estáveis do payload primeiro; sem eles, hash do corpo.
    const eventId = `tiktok:sha256:${payloadFingerprint(obj)}`;
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
