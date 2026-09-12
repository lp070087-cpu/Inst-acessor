/**
 * LIBERAÇÃO MANUAL DE ACESSO — NÚCLEO PURO (sem banco)
 * ======================================================
 * Regras de negócio da liberação manual feita pelo ADMIN, isoladas para
 * testes determinísticos (`npm run billing:test`) sem instanciar o Prisma.
 *
 * Diferenciação de origem:
 *   - `provider = "manual"` e `accessSource = "ADMIN_MANUAL"` → acesso manual.
 *   - `provider = "asaas"`  e `accessSource = "ASAAS"`       → acesso pago.
 * Isso permite à fase futura ("primeiro acesso") saber a origem exata.
 */

export const MANUAL_PROVIDER = "manual";
export const MANUAL_SOURCE = "ADMIN_MANUAL";
export const ASAAS_PROVIDER = "asaas";
export const ASAAS_SOURCE = "ASAAS";

export const MANUAL_MIN_DAYS = 1;
export const MANUAL_MAX_DAYS = 3650;

/** Normaliza e-mail (trim + lowercase). Retorna null se inválido. */
export function normalizeEmail(email: string): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Valida duração em dias (inteiro 1..3650). */
export function validateGrantDays(days: number): boolean {
  return Number.isInteger(days) && days >= MANUAL_MIN_DAYS && days <= MANUAL_MAX_DAYS;
}

/** Data de início = agora; expiração = agora + dias. */
export function computeGrantDates(
  now: Date,
  days: number
): { startAt: Date; expiresAt: Date } {
  return {
    startAt: now,
    expiresAt: new Date(now.getTime() + days * 86_400_000),
  };
}

/**
 * Extensão previsível: o novo vencimento parte de `max(vencimento atual, agora)`
 * + dias. Assim, estender não "rouba" o período já pago/concedido.
 */
export function computeExtendedExpiry(
  currentExpiresAt: Date | null,
  now: Date,
  days: number
): Date {
  const base =
    currentExpiresAt && currentExpiresAt.getTime() > now.getTime()
      ? currentExpiresAt
      : now;
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * Plano de referência (âncora) para o registro local. Acesso manual não é uma
 * compra — usamos o plano oficial mais próximo apenas como vínculo FK
 * obrigatório. A fonte de verdade da duração é `expiresAt`.
 */
export function resolveAnchorPlanSlug(days: number): string {
  if (days <= 7) return "semanal";
  if (days <= 45) return "mensal";
  return "anual";
}
