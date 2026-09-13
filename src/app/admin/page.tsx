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
  ListChecks,
  Hourglass,
  KeyRound,
  ShieldCheck,
  CircleDollarSign,
  ArrowRight,
} from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getAdminOverview } from "@/lib/admin/stats";
import { authorizedAdminEmails } from "@/lib/auth/admin-access";
import { getAIAdminStatus } from "@/lib/admin/ai-config";
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
  const adminEmails = authorizedAdminEmails();
  const aiStatus = await getAIAdminStatus();

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Assinaturas" value={t.subscriptions} icon={CreditCard} hint={`${t.activeSubscriptions} ativas · ${t.expiredSubscriptions} expiradas`} />
        <MetricCard label="Aguardando pago" value={t.pendingPayments} icon={Hourglass} hint="Pagamentos PENDING" />
        <MetricCard label="1º acesso pendente" value={t.pendingFirstAccess} icon={KeyRound} hint="Grants aguardando ativação" />
        <MetricCard label="Instagram" value={t.igConnections} icon={Share2} hint="Contas conectadas" />
      </div>

      {/* Acessos e operações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="TikTok" value={t.tiktokConnections} icon={Music2} hint="Contas conectadas" />
        <MetricCard label="Liberações manuais" value={t.manualGrants} icon={ShieldCheck} hint="Origem ADMIN_MANUAL" />
        <MetricCard label="Fila de publicação" value={t.publishQueue} icon={Send} hint={`${t.publishFailures} falhas`} />
        <MetricCard label="Mensagens de IA" value={t.aiMessages} icon={MessageSquare} hint="Total no banco" />
      </div>

      {/* Atalhos rápidos */}
      <SectionCard
        title="Atalhos rápidos"
        description="Ações administrativas frequentes."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/admin/usuarios" className="group">
            <div className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3 transition-colors hover:border-purple/40 hover:bg-ai-soft">
              <div className="flex items-center gap-2.5">
                <KeyRound size={16} className="text-purple" />
                <span className="text-[13.5px] font-semibold text-ink">Liberar acesso manual</span>
              </div>
              <ArrowRight size={15} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
          <Link href="/admin/assinaturas" className="group">
            <div className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3 transition-colors hover:border-purple/40 hover:bg-ai-soft">
              <div className="flex items-center gap-2.5">
                <CircleDollarSign size={16} className="text-purple" />
                <span className="text-[13.5px] font-semibold text-ink">Assinaturas</span>
              </div>
              <ArrowRight size={15} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
          <Link href="/admin/ia" className="group">
            <div className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3 transition-colors hover:border-purple/40 hover:bg-ai-soft">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={16} className="text-purple" />
                <span className="text-[13.5px] font-semibold text-ink">Configurar IA</span>
              </div>
              <ArrowRight size={15} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
          <Link href="/admin/integracoes" className="group">
            <div className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3 transition-colors hover:border-purple/40 hover:bg-ai-soft">
              <div className="flex items-center gap-2.5">
                <Share2 size={16} className="text-purple" />
                <span className="text-[13.5px] font-semibold text-ink">Integrações</span>
              </div>
              <ArrowRight size={15} className="text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </SectionCard>

      {/* Status da IA */}
      <SectionCard
        title="Status da IA"
        description="Configuração atual dos provedores de IA (apenas status — a chave nunca é exibida)."
        action={
          <Link href="/admin/ia">
            <Button variant="ghost" size="xs">Configurar</Button>
          </Link>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["openai", "gemini"].map((p) => {
            const st = p === "openai" ? aiStatus.openai : aiStatus.gemini;
            const active = aiStatus.activeProvider === p;
            return (
              <div
                key={p}
                className="flex items-center justify-between rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                      st.configured
                        ? "bg-success/10 text-success"
                        : "bg-ink-muted/10 text-ink-muted"
                    }`}
                  >
                    {st.configured ? "Configurada" : "Não configurada"}
                  </span>
                  <span className="text-[13px] font-semibold text-ink capitalize">{p}</span>
                  {active && (
                    <span className="inline-flex items-center rounded-full bg-purple/10 px-2 py-0.5 text-[11.5px] font-medium text-purple">
                      Ativa
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-ink-muted font-data">
                  {st.configured ? st.keyMask : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Segurança do admin */}
      <SectionCard
        title="Administrador exclusivo"
        description="Acesso administrativo restrito ao e-mail oficial. A role no banco não concede privilégios."
      >
        <div className="flex flex-col gap-2">
          {adminEmails.map((email) => (
            // E-mail é um token sem espaços: sem `min-w-0` + `truncate` ele
            // força a largura da linha e estoura em telas de 320px.
            <div key={email} className="flex items-center gap-2.5 min-w-0 rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
              <ShieldCheck size={16} className="text-purple flex-none" />
              <span className="font-data text-[13.5px] text-ink min-w-0 truncate">{email}</span>
              <span className="ml-auto text-[12px] text-success font-medium flex-none">Autorizado</span>
            </div>
          ))}
        </div>
      </SectionCard>

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
                    <td className="py-3 pr-4">
                      {adminEmails.some(
                        (e) => e.toLowerCase() === u.email.toLowerCase()
                      ) ? (
                        <span className="inline-flex items-center rounded-full bg-purple/10 px-2 py-0.5 text-[11.5px] font-medium text-purple">
                          Administrador
                        </span>
                      ) : (
                        <StatusBadge status={u.role} />
                      )}
                    </td>
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
