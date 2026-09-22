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
  /**
   * Valor efetivamente cobrado (travado na criação) — NUNCA lido do client.
   *
   * `null` quando nem a assinatura nem o catálogo têm valor. NÃO é 0: zero é um
   * preço ("grátis"), e transformar ausência em 0 faria a tela afirmar que o
   * plano custa R$ 0,00. Ausência de preço é ausência — a UI mostra a ausência.
   */
  priceCents: number | null;
  currency: string;
  status: string;
  billingType: string;
  billingInterval: string | null;
  autoRenew: boolean;
  startAt: string | null;
  expiresAt: string | null;
  nextBillingAt: string | null;
  canceledAt: string | null;
  /** Confirmação REAL de pagamento (webhook). NUNCA preenchido pelo checkout. */
  paidAt: string | null;
  /** Origem do acesso: "ASAAS" | "ADMIN_MANUAL" | null. */
  accessSource: string | null;
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
  /** Valor travado na criação (Asaas) — preço cobrado de verdade. */
  amountCents: number | null;
  currency: string;
  /** Confirmação REAL de pagamento (webhook). */
  paidAt: Date | null;
  /** Origem do acesso: "ASAAS" | "ADMIN_MANUAL" | null. */
  accessSource: string | null;
  provider: string | null;
  createdAt: Date;
  /**
   * ID da assinatura NO GATEWAY. É o que permite cancelar a recorrência de
   * verdade (`DELETE /subscriptions/{id}` no Asaas). Sem ele, a assinatura
   * nasceu local e não existe nada para cancelar do outro lado.
   */
  externalSubscriptionId: string | null;
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
    // Valor efetivamente cobrado (travado na criação pelo servidor). Quando
    // o gateway estiver ativo, `amountCents` reflete o valor real; senão usa
    // o preço do catálogo (fonte única server-side). Sem nenhum dos dois:
    // `null` — ausência de preço, nunca "R$ 0,00" (ver `SubscriptionView`).
    priceCents: row.amountCents ?? plan?.priceCents ?? null,
    currency: row.currency ?? plan?.currency ?? "BRL",
    status: row.status,
    billingType: row.billingType,
    billingInterval: row.billingInterval,
    autoRenew: row.autoRenew,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    nextBillingAt: row.nextBillingAt ? row.nextBillingAt.toISOString() : null,
    canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    accessSource: row.accessSource ?? null,
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
 *
 * CORREÇÃO: o corpo criava `status: "ACTIVE"`, contradizendo o próprio nome
 * ("Pending") e o comentário acima. Uma assinatura marcada como ACTIVE sem
 * NENHUM pagamento é exatamente a "assinatura fingida" que o produto não pode
 * ter — e, agora que `resolvePremiumAccess` confia em `status`, isso viraria
 * acesso premium gratuito. Passa a nascer PENDING (e sem renovação automática,
 * porque não há cobrança recorrente real por trás).
 *
 * Quando o checkout Asaas ativo confirmar o pagamento, é o webhook que ativa
 * (ver `src/lib/billing/asaas/events.ts`).
 */
export async function createPendingSubscription(
  userId: string,
  planId: string
): Promise<SubscriptionView | null> {
  const plan = await getPlanById(planId);
  if (!plan) return null;

  const now = new Date();

  const created = (await bll.subscription.create({
    data: {
      userId,
      planId,
      status: "PENDING",
      billingType: plan.type,
      billingInterval: plan.billingInterval,
      startAt: null,
      expiresAt: null,
      autoRenew: false,
      nextBillingAt: null,
      provider: null,
      externalCustomerId: null,
      externalSubscriptionId: null,
    },
  })) as unknown as SubscriptionRow;

  return toSubscriptionView(created);
}

/**
 * Marca a renovação futura como cancelada (não cancela o acesso atual).
 * Owner-check.
 *
 * O DEFEITO QUE ESTA FUNÇÃO TINHA
 * -------------------------------
 * Ela só gravava `autoRenew: false` no banco local. Nenhuma chamada saía para o
 * Asaas — `cancelAsaasSubscription` (que faz o `DELETE /subscriptions/{id}` com
 * owner-check) existia pronta e **sem um único chamador**. Efeito real: a tela
 * dizia "renovação cancelada" e o Asaas continuava cobrando na data seguinte. O
 * usuário só descobria no extrato.
 *
 * ORDEM DAS OPERAÇÕES — de propósito, não por acaso
 * -------------------------------------------------
 * Primeiro o GATEWAY, depois o banco local. Se o local viesse primeiro e o
 * Asaas falhasse, o banco diria "cancelado" enquanto o Asaas seguiria cobrando
 * — o pior resultado possível, porque é silencioso. Nesta ordem, uma falha do
 * Asaas deixa o local intacto e a tela pode dizer a verdade.
 *
 * Também de propósito: quando a assinatura recorrente TEM vínculo externo, uma
 * falha no gateway NÃO é engolida. Ela volta como erro para a rota responder
 * 502, em vez de gravar um cancelamento que não aconteceu.
 */
export async function cancelRenewal(
  userId: string,
  subscriptionId: string
): Promise<{ ok: true; subscription: SubscriptionView } | { ok: false; reason: string; message: string }> {
  const existing = (await bll.subscription.findUnique({
    where: { id: subscriptionId },
  })) as unknown as SubscriptionRow | null;

  if (!existing || existing.userId !== userId) {
    return { ok: false, reason: "not_found", message: "Assinatura não encontrada." };
  }

  // Assinatura não recorrente (compra única): não há renovação a cancelar. Nada
  // é chamado no gateway e nada muda — mas a resposta continua sendo sucesso,
  // porque o estado desejado ("não vai renovar") já é o estado atual.
  if (existing.billingType !== "RECURRING") {
    const view = await toSubscriptionView(existing);
    return { ok: true, subscription: view };
  }

  // 1º — GATEWAY. Só é acionado quando existe vínculo externo real; sem ele a
  // assinatura nasceu local e não há nada para cancelar do outro lado.
  const hasExternalLink = Boolean(existing.externalSubscriptionId);
  if (hasExternalLink) {
    const { cancelAsaasSubscription } = await import("@/lib/billing/asaas/service");
    const gateway = await cancelAsaasSubscription({ userId, subscriptionId });

    if (!gateway.ok) {
      return {
        ok: false,
        reason: "gateway",
        message: gateway.message,
      };
    }
  }

  // 2º — BANCO LOCAL, só depois do gateway confirmar.
  const updated = (await bll.subscription.update({
    where: { id: subscriptionId },
    data: { autoRenew: false, canceledAt: new Date() },
  })) as unknown as SubscriptionRow;

  return { ok: true, subscription: await toSubscriptionView(updated) };
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
 * CONTROLE DE ACESSO — função central.
 *
 * ANTES: devolvia `true` fixo ("em desenvolvimento: acesso liberado sempre") e
 * nunca era chamada por ninguém. O efeito prático era uma conta gratuita, sem
 * nenhum grant e sem assinatura, atravessar Score/Rank/IA/Calendário como se
 * tivesse assinado. O comentário prometia "quando o gateway real existir", e o
 * gateway real (Asaas) já existe.
 *
 * AGORA: delega ao resolvedor único `resolvePremiumAccess`, que exige prova de
 * acesso (grant válido do Asaas/webhook, liberação manual do ADMIN, assinatura
 * ativa ou o ADMIN exclusivo). Ausência de dado → `false`. A assinatura da
 * função foi mantida para não quebrar o barrel `@/lib/billing`.
 */
export async function canAccessPaidFeatures(userId: string): Promise<boolean> {
  const { resolvePremiumAccess } = await import("@/lib/access/premium");
  const access = await resolvePremiumAccess(userId);
  return access.hasAccess;
}
// O resolver mora em `@/lib/access/premium` e é importado DINAMICAMENTE acima
// de propósito: `@/lib/billing` é um barrel grande (catálogo, Asaas, adapter) e
// importar o resolvedor no topo criaria dependência circular em tempo de módulo
// (premium → prisma/guard → billing). Em runtime a importação é resolvida uma
// única vez pelo cache do Node/Next.

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
