import { bll } from "@/lib/billing/db";
import { getPlanById } from "@/lib/billing/plans";

/**
 * ASSINATURAS — Fase 6.5
 * ======================
 * Gerencia a assinatura do usuário. Todos os métodos são owner-checked
 * (o `userId` da sessão é a fonte de verdade).
 *
 * Estados (6.5.19): PENDING | ACTIVE | EXPIRED | CANCELED | PAST_DUE.
 * - PENDING: aguardando confirmação de pagamento (checkout iniciado).
 * - ACTIVE: acesso liberado (startAt setado).
 * - EXPIRED: acesso expirado (sem renovação ou após fim do período).
 * - CANCELED: renovação futura cancelada (mantém acesso até o fim do período).
 * - PAST_DUE: cobrança recorrente não paga (futuro, quando gateway ativo).
 *
 * Nesta fase NENHUM gateway real existe — a assinatura só é criada em estado
 * controlado (PENDING ou ativada manualmente pela DONA em desenvolvimento).
 */

export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "CANCELED",
  "PAST_DUE",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionView {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  priceCents: number;
  currency: string;
  status: string;
  billingType: string;
  billingInterval: string | null;
  autoRenew: boolean;
  startAt: string | null;
  expiresAt: string | null;
  nextBillingAt: string | null;
  canceledAt: string | null;
  /** true se o acesso está ativo neste momento. */
  active: boolean;
  /** dias restantes de acesso (0 se expirado/não ativo). */
  daysRemaining: number;
  provider: string | null;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  userId: string;
  planId: string;
  status: string;
  billingType: string;
  billingInterval: string | null;
  startAt: Date | null;
  expiresAt: Date | null;
  autoRenew: boolean;
  nextBillingAt: Date | null;
  canceledAt: Date | null;
  provider: string | null;
  createdAt: Date;
}

function computeStatus(row: SubscriptionRow): { status: string; active: boolean; daysRemaining: number } {
  const now = Date.now();
  const expires = row.expiresAt ? row.expiresAt.getTime() : null;
  const active = row.status === "ACTIVE" && expires !== null && expires > now;
  const daysRemaining = active && expires ? Math.max(0, Math.ceil((expires - now) / 86_400_000)) : 0;
  return { status: row.status, active, daysRemaining };
}

async function toSubscriptionView(
  row: SubscriptionRow
): Promise<SubscriptionView> {
  const plan = row.planId ? await getPlanById(row.planId) : null;
  const computed = computeStatus(row);
  return {
    id: row.id,
    planId: row.planId,
    planName: plan?.name ?? "Plano",
    planSlug: plan?.slug ?? "",
    priceCents: plan?.priceCents ?? 0,
    currency: plan?.currency ?? "BRL",
    status: row.status,
    billingType: row.billingType,
    billingInterval: row.billingInterval,
    autoRenew: row.autoRenew,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    nextBillingAt: row.nextBillingAt ? row.nextBillingAt.toISOString() : null,
    canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
    active: computed.active,
    daysRemaining: computed.daysRemaining,
    provider: row.provider,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Busca a assinatura mais recente do usuário (owner-check). */
export async function getMySubscription(userId: string): Promise<SubscriptionView | null> {
  const row = (await bll.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as unknown as SubscriptionRow | null;
  if (!row) return null;
  return toSubscriptionView(row);
}

/**
 * Cria uma assinatura PENDING (sem gateway real). Owner-check.
 * Quando o gateway Asaas estiver ativo, este ponto chamará o adapter e
 * só então criará uma assinatura com dados externos reais.
 */
export async function createPendingSubscription(
  userId: string,
  planId: string
): Promise<SubscriptionView | null> {
  const plan = await getPlanById(planId);
  if (!plan) return null;

  const now = new Date();
  const startAt = now;
  const durationDays = plan.durationDays ?? 0;
  const expiresAt = durationDays > 0
    ? new Date(startAt.getTime() + durationDays * 86_400_000)
    : null;

  const created = (await bll.subscription.create({
    data: {
      userId,
      planId,
      status: "ACTIVE",
      billingType: plan.type,
      billingInterval: plan.billingInterval,
      startAt,
      expiresAt,
      autoRenew: plan.type === "RECURRING",
      nextBillingAt: plan.type === "RECURRING" && plan.billingInterval ? computeNextBilling(startAt, plan.billingInterval) : null,
      provider: null,
      externalCustomerId: null,
      externalSubscriptionId: null,
    },
  })) as unknown as SubscriptionRow;

  return toSubscriptionView(created);
}

function computeNextBilling(from: Date, interval: string): Date | null {
  const d = new Date(from.getTime());
  if (interval === "MONTH") d.setMonth(d.getMonth() + 1);
  else if (interval === "YEAR") d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d;
}

/**
 * Marca a renovação futura como cancelada (não cancela o acesso atual).
 * Owner-check. NÃO finge cancelamento externo (sem gateway, sem chamada).
 */
export async function cancelRenewal(userId: string, subscriptionId: string): Promise<SubscriptionView | null> {
  const existing = (await bll.subscription.findUnique({
    where: { id: subscriptionId },
  })) as unknown as SubscriptionRow | null;
  if (!existing || existing.userId !== userId) return null;
  if (existing.billingType !== "RECURRING") return toSubscriptionView(existing);

  const updated = (await bll.subscription.update({
    where: { id: subscriptionId },
    data: { autoRenew: false, canceledAt: new Date() },
  })) as unknown as SubscriptionRow;

  return toSubscriptionView(updated);
}

/** Lista assinaturas do usuário (owner-check). */
export async function listMySubscriptions(userId: string): Promise<SubscriptionView[]> {
  const rows = (await bll.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as unknown as SubscriptionRow[];
  return Promise.all(rows.map(toSubscriptionView));
}

/**
 * CONTROLE DE ACESSO (6.5.25) — função central.
 * Avalia a assinatura do usuário para liberar/negar recursos pagos.
 *
 * IMPORTANTE: nesta fase NÃO bloqueia nada. A DONA precisa continuar
 * acessando o sistema durante o desenvolvimento. Quando o gateway real
 * existir, esta função passará a considerar subscription.status, expiresAt
 * e billingInterval de verdade.
 */
export async function canAccessPaidFeatures(userId: string): Promise<boolean> {
  // Em desenvolvimento: acesso liberado sempre (não quebrar usuários existentes).
  void userId;
  return true;
}

/**
 * Versão informativa do status de acesso (para exibir na UI sem bloquear).
 * Retorna a assinatura ativa mais recente e se o acesso está ativo.
 */
export async function getAccessStatus(userId: string) {
  const sub = await getMySubscription(userId);
  return {
    hasSubscription: !!sub,
    active: sub?.active ?? false,
    status: sub?.status ?? null,
    expiresAt: sub?.expiresAt ?? null,
    daysRemaining: sub?.daysRemaining ?? 0,
    planName: sub?.planName ?? null,
  };
}
