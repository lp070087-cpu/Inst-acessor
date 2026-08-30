import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserPlus,
  CreditCard,
  Coins,
  Share2,
  Music2,
  MessageSquare,
  Send,
  AlertTriangle,
  Zap,
  ListChecks,
} from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getAdminOverview } from "@/lib/admin/stats";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Administração — Inst Acessor",
  description: "Painel administrativo do Inst Acessor.",
};

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default async function AdminHomePage() {
  await requireAdminSession();
  const overview = await getAdminOverview();
  const t = overview.totals;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink">
          Visão Geral
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Métricas reais do sistema — nenhum número é inventado.
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Usuários" value={t.users} icon={Users} hint={`${t.newUsersLast30d} novos nos últimos 30 dias`} />
        <MetricCard label="Ativos" value={t.activeUsers} icon={UserCheck} hint="Contas com status ACTIVE" />
        <MetricCard label="Novos (30d)" value={t.newUsersLast30d} icon={UserPlus} hint="Cadastros nos últimos 30 dias" />
        <MetricCard label="Receita (paga)" value={brl.format(t.revenueCents / 100)} icon={Coins} hint={`${t.paidPayments} pagamentos confirmados`} />
      </div>

      {/* Assinaturas e conexões */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricCard label="Assinaturas" value={t.subscriptions} icon={CreditCard} hint={`${t.activeSubscriptions} ativas`} />
        <MetricCard label="Instagram" value={t.igConnections} icon={Share2} hint="Contas conectadas" />
        <MetricCard label="TikTok" value={t.tiktokConnections} icon={Music2} hint="Contas conectadas" />
      </div>

      {/* Operações e saúde */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Mensagens de IA" value={t.aiMessages} icon={MessageSquare} hint="Total no banco" />
        <MetricCard label="Fila de publicação" value={t.publishQueue} icon={Send} hint="Itens agendados/em processo" />
        <MetricCard label="Falhas de publicação" value={t.publishFailures} icon={AlertTriangle} hint="Status FALHOU" />
        <MetricCard label="Automações" value={t.automations} icon={Zap} hint={`${t.growthActions} ações de crescimento`} />
      </div>

      {/* Distribuição de planos */}
      <SectionCard
        title="Distribuição de planos"
        description="Assinaturas ativas/pendentes agrupadas por plano."
      >
        {overview.planDistribution.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhuma assinatura ainda"
            description="Quando usuários assinarem, os planos aparecerão aqui."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.planDistribution.map((p) => (
              <div
                key={p.planId}
                className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3"
              >
                <span className="text-[13.5px] font-semibold text-ink">{p.planName}</span>
                <span className="font-data text-[15px] font-bold text-purple">{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Usuários recentes */}
      <SectionCard
        title="Usuários recentes"
        description="Últimos cadastros no sistema."
        action={
          <Link href="/admin/usuarios">
            <Button variant="ghost" size="xs">Ver todos</Button>
          </Link>
        }
      >
        {overview.recentUsers.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário ainda" description="Os cadastros aparecerão aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                  <th className="py-2.5 pr-4 font-semibold">Nome</th>
                  <th className="py-2.5 pr-4 font-semibold">E-mail</th>
                  <th className="py-2.5 pr-4 font-semibold">Papel</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border-soft/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-ink">{u.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-soft">{u.email}</td>
                    <td className="py-3 pr-4"><StatusBadge status={u.role} /></td>
                    <td className="py-3 pr-4"><StatusBadge status={u.status} /></td>
                    <td className="py-3 text-ink-muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Pagamentos recentes */}
      <SectionCard
        title="Pagamentos recentes"
        description="Últimas transações confirmadas ou em andamento."
        action={
          <Link href="/admin/assinaturas">
            <Button variant="ghost" size="xs">Ver assinaturas</Button>
          </Link>
        }
      >
        {overview.recentPayments.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nenhum pagamento ainda" description="Os pagamentos aparecerão aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                  <th className="py-2.5 pr-4 font-semibold">Usuário</th>
                  <th className="py-2.5 pr-4 font-semibold">Valor</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-border-soft/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-ink">
                      {p.user?.name ?? p.user?.email ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-data font-semibold text-ink">
                      {brl.format(p.amountCents / 100)}
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 text-ink-muted">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
