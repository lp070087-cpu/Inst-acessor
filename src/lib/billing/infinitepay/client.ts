import { INFINITEPAY_PAYMENT_CHECK_URL, getInfinitePayConfig } from "./config";

/**
 * INFINITEPAY — CLIENTE HTTP (server-only)
 * =========================================
 * Camada fina sobre `fetch` para a API de confirmação do InfinitePay.
 *
 * Regras:
 *   - NUNCA importar em client component (segredos do servidor).
 *   - NENHUMA credencial é logada.
 *   - Timeout em todas as chamadas.
 *   - Falha de rede/HTTP NUNCA vira "pagamento confirmado" — o chamador deve
 *     tratar erro como NÃO confirmado (fail-closed).
 */

export const INFINITEPAY_TIMEOUT_MS = 10_000;

export interface PaymentCheckResult {
  ok: boolean;
  paid: boolean;
  amountCents: number | null;
  paidAmountCents: number | null;
  installments: number | null;
  captureMethod: string | null;
  /** true se a chamada retornou um erro controlado (ex.: não encontrado). */
  error: string | null;
}

/** Erro de HTTP tipado com status e corpo (sanitizado) da API. */
export class InfinitePayHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "InfinitePayHttpError";
    this.status = status;
  }
}

/**
 * Consulta o status REAL do pagamento junto ao InfinitePay.
 * `payment_check` (POST https://api.checkout.infinitepay.io/payment_check)
 * espera referências estáveis (handle/order_nsu/transaction_nsu/slug).
 *
 * - Sem `INFINITEPAY_API_KEY` → retorna `{ ok:false, error:"not_configured" }`
 *   (NUNCA simula confirmação).
 * - Só retorna `paid:true` quando a API responder explicitamente como pago.
 */
export async function checkPayment(
  refs: {
    orderNsu?: string | null;
    transactionNsu?: string | null;
    invoiceSlug?: string | null;
    planSlug?: string | null;
  }
): Promise<PaymentCheckResult> {
  const cfg = getInfinitePayConfig();
  if (!cfg.apiKey) {
    return { ok: false, paid: false, amountCents: null, paidAmountCents: null, installments: null, captureMethod: null, error: "not_configured" };
  }

  const body: Record<string, unknown> = {};
  if (refs.transactionNsu) body.transaction_nsu = refs.transactionNsu;
  if (refs.orderNsu) body.order_nsu = refs.orderNsu;
  if (refs.invoiceSlug) body.handle = refs.invoiceSlug;
  if (refs.planSlug) body.slug = refs.planSlug;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INFINITEPAY_TIMEOUT_MS);

  try {
    const res = await fetch(INFINITEPAY_PAYMENT_CHECK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        "User-Agent": "InstAcessor/1.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed === "object" && parsed !== null) data = parsed as Record<string, unknown>;
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      throw new InfinitePayHttpError(res.status, "payment_check falhou no provedor.");
    }

    const paid =
      data?.paid === true || data?.status === "paid" || data?.status === "PAID";
    const amount = data?.amount ?? data?.amount_cents;
    const paidAmount = data?.paid_amount ?? data?.paid_amount_cents;

    return {
      ok: true,
      paid,
      amountCents:
        typeof amount === "number" ? Math.round(amount * 100) :
        typeof amount === "string" ? Math.round(Number(amount) * 100) : null,
      paidAmountCents:
        typeof paidAmount === "number" ? Math.round(paidAmount * 100) :
        typeof paidAmount === "string" ? Math.round(Number(paidAmount) * 100) : null,
      installments: typeof data?.installments === "number" ? data.installments : null,
      captureMethod: typeof data?.capture_method === "string" ? data.capture_method : null,
      error: null,
    };
  } catch (err) {
    if (err instanceof InfinitePayHttpError) throw err;
    return {
      ok: false, paid: false, amountCents: null, paidAmountCents: null,
      installments: null, captureMethod: null,
      error: err instanceof Error && err.name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}
