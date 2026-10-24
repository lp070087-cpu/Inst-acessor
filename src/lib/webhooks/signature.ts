import { createHmac, timingSafeEqual } from "crypto";

/**
 * VERIFICAÇÃO DE ORIGEM DE WEBHOOKS (Meta/Instagram e TikTok)
 * ===========================================================
 * Assinatura de payload no padrão da Meta:
 *   `sha256=<hex digest do HMAC-SHA256(chave=app_secret, mensagem=raw body)>`
 *
 * - Usa `timingSafeEqual` para evitar timing attacks.
 * - NUNCA loga a assinatura recebida/computada.
 */

function safeEqualHex(computed: string, provided: string): boolean {
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(provided.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Valida o header `X-Hub-Signature-256` (Meta) ou `X-Signature` (TikTok).
 * Retorna true se o payload veio mesmo da plataforma (app_secret correto).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  // Meta envia: sha256=<hex>
  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(computed, expected);
}

/**
 * Versão curta para quando a plataforma não envia assinatura e o webhook
 * depende apenas do verify token (challenge GET). Este helper não é usado
 * no fluxo POST assinado.
 */
export function hmacHex(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

// ================================================================
// TIKTOK — assinatura do webhook (`TikTok-Signature`)
// ================================================================

/**
 * Segredo usado para validar a assinatura do webhook do TikTok.
 *
 * Prioridade: `TIKTOK_WEBHOOK_SECRET` (dedicado) → `TIKTOK_CLIENT_SECRET`
 * (o App Secret do app TikTok, que é o segredo que a plataforma usa por padrão).
 * O valor NUNCA é logado, impresso ou devolvido.
 */
export function getTikTokWebhookSecret(): string {
  const dedicated = (process.env.TIKTOK_WEBHOOK_SECRET ?? "").trim();
  if (dedicated) return dedicated;
  return (process.env.TIKTOK_CLIENT_SECRET ?? "").trim();
}

/**
 * Janela de tolerância do timestamp da assinatura (proteção contra replay): uma
 * assinatura válida mas ANTIGA é recusada, para que um corpo capturado não possa
 * ser reenviado indefinidamente. 5 minutos é curto o bastante para bloquear
 * replay e largo o bastante para tolerar desvio de relógio entre servidores.
 */
const TIKTOK_MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

export type TikTokSignatureReason =
  | "missing_secret"
  | "missing_header"
  | "malformed_header"
  | "stale_timestamp"
  | "invalid_signature";

export interface TikTokSignatureResult {
  ok: boolean;
  /** Motivo do fracasso (sanitizado — nunca inclui a assinatura do chamador). */
  reason?: TikTokSignatureReason;
}

/**
 * Valida o header `TikTok-Signature`, no formato `t=<ts>,s=<sig>`.
 *
 * ESQUEMA (assunção declarada — ver `docs/INTEGRACOES-INSTAGRAM-TIKTOK.md`):
 *   sig = HMAC-SHA256(chave = App Secret do TikTok, mensagem = `${t}.${rawBody}`)
 *   em hex minúsculo, comparada em tempo constante.
 *
 * O `t` do TikTok é um Unix timestamp — normalmente em SEGUNDOS, mas algumas
 * assinaturas trazem MILISSEGUNDOS. Como a unidade não muda a mensagem assinada
 * (`${t}.${rawBody}` usa o texto CRU do `t`), apenas a checagem de idade usa a
 * magnitude para decidir a unidade — assim nenhuma das duas formas é recusada
 * por engano.
 *
 * FAIL-CLOSED em TODOS os caminhos: sem segredo, sem header, header malformado,
 * timestamp fora da janela ou assinatura divergente → `{ ok: false }`. Nunca
 * "passa por padrão".
 */
export function verifyTikTokSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs: number = Date.now()
): TikTokSignatureResult {
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_header" };

  let ts: string | null = null;
  let sig: string | null = null;
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") ts = value;
    else if (key === "s") sig = value;
  }
  if (!ts || !sig) return { ok: false, reason: "malformed_header" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "malformed_header" };

  // Magnitude → unidade: acima de ~1e11 é milissegundos (segundos só chegam a
  // ~1e10 por muitos anos).
  const tsMs = tsNum > 1e11 ? tsNum : tsNum * 1000;
  if (Math.abs(nowMs - tsMs) > TIKTOK_MAX_SIGNATURE_AGE_MS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const computed = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`, "utf8")
    .digest("hex");
  if (!safeEqualHex(computed, sig)) return { ok: false, reason: "invalid_signature" };
  return { ok: true };
}
