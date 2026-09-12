/**
 * INFINITEPAY — CONFIGURAÇÃO (server-only)
 * =========================================
 * Lê as variáveis de ambiente do InfinitePay APENAS no servidor.
 *
 * NUNCA criar `NEXT_PUBLIC_INFINITEPAY_*` nem expor valores ao client.
 * NUNCA logar a API key.
 *
 * Estado oficial desde 2026-08-31:
 *   - Checkout = LINKS PÚBLICOS do InfinitePay por plano (sem chave necessária —
 *     ver `src/lib/billing/plans/catalog.ts` → `checkoutUrl`).
 *   - `INFINITEPAY_API_KEY`  → habilita a CONFIRMAÇÃO de pagamento no servidor
 *     (`payment_check`) dentro do webhook. Ausente = o webhook registra o evento
 *     mas NÃO libera acesso (fail-closed — nunca confiamos só no POST).
 *   - `INFINITEPAY_WEBHOOK_TOKEN` → RESERVADO. A autenticação do webhook só será
 *     aplicada se a documentação oficial do InfinitePay comprovar o mecanismo
 *     (nada de HMAC/token inventado). Ausente = nenhum token é exigido.
 *   - `INFINITEPAY_ACCOUNT_ID` → referência da conta (rota pública dos planos).
 */

/** URL da API de confirmação de pagamento do InfinitePay. */
export const INFINITEPAY_PAYMENT_CHECK_URL =
  "https://api.checkout.infinitepay.io/payment_check";

export interface InfinitePayConfig {
  /** Chave de API. Vazia = confirmação server-side indisponível. */
  apiKey: string;
  /** Token de webhook (reservado — ver doc acima). */
  webhookToken: string;
  /** Conta InfinitePay (referência dos planos públicos). */
  accountId: string;
}

/** Lê a configuração do InfinitePay a partir das env vars do servidor. */
export function getInfinitePayConfig(): InfinitePayConfig {
  return {
    apiKey: (process.env.INFINITEPAY_API_KEY ?? "").trim(),
    webhookToken: (process.env.INFINITEPAY_WEBHOOK_TOKEN ?? "").trim(),
    accountId: (process.env.INFINITEPAY_ACCOUNT_ID ?? "").trim(),
  };
}

/**
 * Status resumido para o painel admin — NUNCA revela valores.
 * Campos honestos (nada é "conectado" sem prova):
 *   - `configured`          → INFINITEPAY_API_KEY presente (confirmação possível).
 *   - `webhookConfigured`   → INFINITEPAY_WEBHOOK_TOKEN presente.
 *   - `checkoutsReady`      → os 3 planos têm checkoutUrl no catálogo oficial.
 *   - `label`               → rótulo legível do estado real.
 */
export function infinitepayStatus(): {
  configured: boolean;
  webhookConfigured: boolean;
  checkoutsReady: boolean;
  label: string;
} {
  const cfg = getInfinitePayConfig();
  const configured = Boolean(cfg.apiKey);
  return {
    configured,
    webhookConfigured: Boolean(cfg.webhookToken),
    checkoutsReady: true, // links públicos por plano — sempre disponíveis no catálogo
    label: configured
      ? "Checkouts + confirmação configurados"
      : "Checkouts configurados · Webhook aguardando configuração",
  };
}
