import { prisma } from "@/lib/db";

/**
 * ADMIN — Métricas reais para o Dashboard administrativo.
 * ======================================================
 * NUNCA inventa números: cada métrica é contada direto do banco.
 * Quando não há dados, retorna zero/estado vazio — a UI mostra
 * o empty state correspondente.
 */

export interface AdminOverview {
  totals: {
    users: number;
    activeUsers: number;
    newUsersLast30d: number;
    subscriptions: number;
    activeSubscriptions: number;
    /** Assinaturas com status EXPIRED (acesso vencido). */
    expiredSubscriptions: number;
    /** Pagamentos com status PENDING (aguardando confirmação). */
    pendingPayments: number;
    paidPayments: number;
    revenueCents: number;
    igConnections: number;
    tiktokConnections: number;
    aiMessages: number;
    publishQueue: number;
    publishFailures: number;
    automations: number;
    growthActions: number;
    /** Liberações de acesso aguardando ativação (primeiro acesso). */
    pendingFirstAccess: number;
    /** Liberações de acesso manuais (ADMIN_MANUAL), totais. */
    manualGrants: number;
  };
  recentUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    status: string;
    createdAt: Date;
  }>;
  recentPayments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: Date;
    user: { id: string; name: string | null; email: string } | null;
  }>;
  planDistribution: Array<{
    planId: string | null;
    planName: string;
    count: number;
  }>;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    users,
    activeUsers,
    newUsersLast30d,
    subscriptions,
    activeSubscriptions,
    expiredSubscriptions,
    pendingPayments,
    paidPayments,
    publishQueue,
    publishFailures,
    automations,
    growthActions,
    igConnections,
    tiktokConnections,
    aiMessages,
    pendingFirstAccess,
    manualGrants,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { createdAt: { gte: since30d } } }),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "PAID" } }),
    prisma.publishQueue.count(),
    prisma.publishQueue.count({ where: { status: "FALHOU" } }),
    prisma.automationRule.count(),
    prisma.growthAction.count(),
    prisma.socialConnection.count({ where: { platform: "instagram", status: "CONNECTED" } }),
    prisma.socialConnection.count({ where: { platform: "tiktok", status: "CONNECTED" } }),
    prisma.aIMessage.count(),
    (prisma as unknown as { accessGrant: { count(args?: unknown): Promise<number> } }).accessGrant.count({ where: { status: "PENDING_FIRST_ACCESS" } }),
    (prisma as unknown as { accessGrant: { count(args?: unknown): Promise<number> } }).accessGrant.count({ where: { origin: "ADMIN_MANUAL" } }),
  ]);

  const revenueAgg = await prisma.payment.aggregate({
    where: { status: "PAID" },
    _sum: { amountCents: true },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });

  const recentPayments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Distribuição por plano entre assinaturas (não-canceladas).
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PENDING", "PAST_DUE"] } },
    select: { planId: true },
  });
  const planIds = [...new Set(subs.map((s) => s.planId))];
  const plans = await prisma.plan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true },
  });
  const planNameById = new Map(plans.map((p) => [p.id, p.name]));
  const planCounts = new Map<string, number>();
  for (const s of subs) {
    const key = s.planId ?? "sem_plano";
    planCounts.set(key, (planCounts.get(key) ?? 0) + 1);
  }
  const planDistribution = [...planCounts.entries()]
    .map(([planId, count]) => ({
      planId,
      planName: planNameById.get(planId) ?? "Sem plano",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totals: {
      users,
      activeUsers,
      newUsersLast30d,
      subscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      pendingPayments,
      paidPayments,
      revenueCents: revenueAgg._sum.amountCents ?? 0,
      igConnections,
      tiktokConnections,
      aiMessages,
      publishQueue,
      publishFailures,
      automations,
      growthActions,
      pendingFirstAccess,
      manualGrants,
    },
    recentUsers,
    recentPayments,
    planDistribution,
  };
}
