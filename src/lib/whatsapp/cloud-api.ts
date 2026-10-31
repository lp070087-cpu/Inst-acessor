/**
 * WHATSAPP BUSINESS PLATFORM — CLOUD API (server-only, fail-closed)
 * ================================================================
 * Official transport: POST https://graph.facebook.com/{version}/{phone-number-id}/messages
 * with `type: "template"` (Meta-approved templates only; free-form text is never sent).
 *
 * Environment (names only; values are never logged or returned):
 *   WHATSAPP_WORKER_ENABLED            must be exactly "true"
 *   WHATSAPP_ACCESS_TOKEN              System User token with whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID           numeric id of the business phone number
 *   WHATSAPP_GRAPH_VERSION             optional, e.g. "v23.0" (default below)
 *   WHATSAPP_TEMPLATE_LAUNCH           approved template name for the plans opening
 *   WHATSAPP_TEMPLATE_NEWS             approved template name for app news
 *   WHATSAPP_TEMPLATE_LANG             template language code (default "pt_BR")
 *   WHATSAPP_TEMPLATE_NAME_PARAM       optional "true": template body has {{1}} = first name
 *
 * Not configured → NOT_CONFIGURED and no request: rows stay HELD (never a fake send).
 * The Cloud API has no idempotency header: double-send protection is the outbox lease +
 * the LaunchNotification unique key, and any ambiguous outcome is UNCERTAIN (never retried).
 */

export const WHATSAPP_DEFAULT_GRAPH_VERSION = "v23.0";
const TIMEOUT_MS = 12_000;

export type WhatsAppTemplateKind = "LAUNCH" | "NEWS";

type Config = { token: string; phoneNumberId: string; version: string; language: string; nameParam: boolean };

function readConfig(): Config | null {
  if (process.env.WHATSAPP_WORKER_ENABLED !== "true") return null;
  const token = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
  const version = (process.env.WHATSAPP_GRAPH_VERSION ?? "").trim() || WHATSAPP_DEFAULT_GRAPH_VERSION;
  const language = (process.env.WHATSAPP_TEMPLATE_LANG ?? "").trim() || "pt_BR";
  if (!/^[\x21-\x7e]{20,1024}$/.test(token) || !/^\d{5,25}$/.test(phoneNumberId) || !/^v\d{1,2}\.\d{1,2}$/.test(version) ||
    !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)) return null;
  return { token, phoneNumberId, version, language, nameParam: process.env.WHATSAPP_TEMPLATE_NAME_PARAM === "true" };
}

/** Approved template name for a campaign kind, or null when not configured. */
export function whatsAppTemplateFor(kind: WhatsAppTemplateKind): string | null {
  const name = (kind === "LAUNCH" ? process.env.WHATSAPP_TEMPLATE_LAUNCH : process.env.WHATSAPP_TEMPLATE_NEWS)?.trim() ?? "";
  return /^[a-z0-9_]{1,512}$/.test(name) ? name : null;
}

/** Transport configured (flag + credentials). Template presence is checked per kind. */
export function isWhatsAppConfigured(kind?: WhatsAppTemplateKind): boolean {
  return readConfig() !== null && (!kind || whatsAppTemplateFor(kind) !== null);
}

export type WhatsAppSendResult =
  | { status: "SENT"; providerId: string }
  | { status: "NOT_CONFIGURED" }
  /** Throughput / spam / pair rate limit: nothing sent, stop the batch, retry later. */
  | { status: "RATE_LIMITED"; code: number }
  /** Template missing, paused, disabled or parameters rejected: nothing sent. */
  | { status: "TEMPLATE_ERROR"; code: number }
  /** This recipient cannot receive the message: nothing sent. */
  | { status: "RECIPIENT_ERROR"; code: number }
  /** Credentials, permissions, account or payload problem: nothing sent, stop the batch. */
  | { status: "REJECTED"; code: number; httpStatus: number }
  /** May have been accepted: never retry automatically. */
  | { status: "UNCERTAIN"; reason: "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_RESPONSE" };

// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);
const RECIPIENT_CODES = new Set([131021, 131026, 131030, 131050, 131051]);
const isTemplateCode = (code: number) => (code >= 132000 && code < 133000) || code === 131008 || code === 131009;

export function classifyWhatsAppError(httpStatus: number, code: number | undefined): WhatsAppSendResult {
  if (code === undefined || !Number.isInteger(code)) {
    return httpStatus === 429 ? { status: "RATE_LIMITED", code: 0 } : httpStatus >= 400 && httpStatus < 500
      ? { status: "REJECTED", code: 0, httpStatus } : { status: "UNCERTAIN", reason: "HTTP_STATUS" };
  }
  if (RATE_LIMIT_CODES.has(code)) return { status: "RATE_LIMITED", code };
  if (isTemplateCode(code)) return { status: "TEMPLATE_ERROR", code };
  if (RECIPIENT_CODES.has(code)) return { status: "RECIPIENT_ERROR", code };
  // 5xx / generic 131000 / 1 / 2: the request may have been processed.
  if (httpStatus >= 500 || [1, 2, 131000].includes(code)) return { status: "UNCERTAIN", reason: "HTTP_STATUS" };
  return { status: "REJECTED", code, httpStatus };
}

/**
 * Sends one approved template. Never throws; never logs recipient, token or body.
 * `recipientE164` must be "+<digits>".
 */
export async function sendWhatsAppTemplate(input: { recipientE164: string; kind: WhatsAppTemplateKind; firstName?: string }): Promise<WhatsAppSendResult> {
  const config = readConfig();
  const template = whatsAppTemplateFor(input.kind);
  if (!config || !template) return { status: "NOT_CONFIGURED" };
  if (!/^\+[1-9]\d{7,14}$/.test(input.recipientE164)) return { status: "RECIPIENT_ERROR", code: 0 };
  const firstName = (input.firstName ?? "").trim().split(/\s+/)[0]?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 60) || "tudo bem";
  const body = {
    messaging_product: "whatsapp", recipient_type: "individual", to: input.recipientE164.slice(1), type: "template",
    template: {
      name: template, language: { code: config.language },
      ...(config.nameParam ? { components: [{ type: "body", parameters: [{ type: "text", text: firstName }] }] } : {}),
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = json && typeof json === "object" ? (json as { error?: { code?: unknown } }).error : undefined;
      const code = typeof error?.code === "number" ? error.code : undefined;
      console.error(`[whatsapp] template não aceito http=${res.status} code=${code ?? "?"}`);
      return classifyWhatsAppError(res.status, code);
    }
    const messages = json && typeof json === "object" ? (json as { messages?: unknown }).messages : undefined;
    const id = Array.isArray(messages) && messages[0] && typeof messages[0] === "object" ? (messages[0] as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_.:~+/=-]{1,200}$/.test(id)) return { status: "UNCERTAIN", reason: "INVALID_RESPONSE" };
    return { status: "SENT", providerId: id };
  } catch (err) {
    const timeout = controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
    console.error(`[whatsapp] envio sem confirmação: ${timeout ? "timeout" : "falha de conexão"}`);
    return { status: "UNCERTAIN", reason: timeout ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
