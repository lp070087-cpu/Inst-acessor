import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";

/**
 * INFINITEPAY — PARSER DE WEBHOOK
 * =================================
 * Extrai e valida eventos do payload do webhook do InfinitePay.
 *
 * Regras de segurança:
 *   - NUNCA confia em `userId` vindo do payload — o dono é localizado pela
 *     referência externa no banco.
 *   - Exige referência estável (`order_nsu` e/ou `transaction_nsu`) para
 *     idempotência determinística. Sem referência → rejeita (400).
 *   - Extrai valores de forma tipada e segura (sem eval/regex soltos).
 *   - O payload persistido é SEMPRE sanitizado (nunca tokens/secrets).
 *
 * Campos esperados do InfinitePay (checkout):
 *   invoice_slug, amount, paid_amount, installments, capture_method,
 *   transaction_nsu, order_nsu, receipt_url, items[]
 */

export interface ParsedInfinitePayEvent {
  /** ID determinístico e estável para idempotência. */
  eventId: string;
  /** Referência estável da ordem (nsu da ordem). */
  orderNsu: string | null;
  /** Referência estável da transação (nsu da transação). */
  transactionNsu: string | null;
  /** Slug do plano (link público) quando informado. */
  planSlug: string | null;
  /** Valor total em centavos (int). */
  amountCents: number | null;
  /** Valor efetivamente pago em centavos (int). */
  paidAmountCents: number | null;
  /** Indicador de pagamento aprovado (booleano honesto). */
  paid: boolean;
  /** Payload bruto (será sanitizado antes de persistir). */
  raw: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numToCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function centsFromString(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Converte o payload do InfinitePay em um evento tipado.
 * Retorna `null` se não houver referência estável (ordem/transação).
 */
export function parseInfinitePayWebhook(payload: unknown): ParsedInfinitePayEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const raw = payload as Record<string, unknown>;

  const orderNsu = str(raw.order_nsu ?? raw.orderNsu);
  const transactionNsu = str(raw.transaction_nsu ?? raw.transactionNsu);
  const invoiceSlug = str(raw.invoice_slug ?? raw.invoiceSlug);

  // Idempotência determinística: prioriza a transação; usa a ordem como fallback.
  const eventId =
    (transactionNsu ? `ip:tx:${transactionNsu}` : null) ??
    (orderNsu ? `ip:order:${orderNsu}` : null) ??
    (invoiceSlug ? `ip:invoice:${invoiceSlug}` : null);

  if (!eventId) {
    // Sem referência externa estável — não processa (evita idempotência fraca).
    return null;
  }

  // Identifica o plano pelo slug do link público, se vier no payload.
  let planSlug: string | null = null;
  const maybeItems = Array.isArray(raw.items) ? raw.items : [];
  for (const it of maybeItems) {
    if (typeof it !== "object" || it === null) continue;
    const obj = it as Record<string, unknown>;
    const slug = str(obj.slug ?? obj.plan_slug ?? obj.id);
    if (slug && PLAN_CATALOG.some((p) => p.slug === slug)) {
      planSlug = slug;
      break;
    }
  }

  const amount = raw.amount ?? raw.amount_cents ?? raw.total;
  const paidAmount = raw.paid_amount ?? raw.paidAmount ?? raw.paid_amount_cents;

  return {
    eventId,
    orderNsu,
    transactionNsu,
    planSlug,
    amountCents: numToCents(amount) ?? centsFromString(amount),
    paidAmountCents: numToCents(paidAmount) ?? centsFromString(paidAmount),
    paid: raw.paid === true || raw.status === "paid" || raw.status === "PAID",
    raw,
  };
}

/** Remove chaves sensíveis conhecidas de um objeto (nunca logar tokens). */
export function sanitizeInfinitePayPayload(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map(sanitizeInfinitePayPayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|access_|apikey|api_key|authorization|signature/i.test(k)) continue;
    out[k] = typeof v === "object" && v !== null ? sanitizeInfinitePayPayload(v) : v;
  }
  return out;
}
