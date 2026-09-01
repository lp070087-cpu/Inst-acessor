import type { Metadata } from "next";
import { CreditCard, ShieldCheck } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { bll } from "@/lib/billing/db";
import { infinitepayStatus } from "@/lib/billing/infinitepay/config";
import { INFINITEPAY_SOURCE } from "@/lib/billing/infinitepay/events";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** Linha de assinatura para o painel admin (com as relações e campos novos). */
interface AdminSubscriptionRow {
  id: string;
  status: string;
  billingType: string;
  billingInterval: string | null;
  startAt: Date | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  autoRenew: boolean;
  provider: string | null;
  accessSource: string | null;
  grantedByAdminId: string | null;
  amountCents: number | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  externalPaymentId: string | null;
  user: { name: string | null; email: string } | null;
  plan: { name: string; priceCents: number } | null;
}

/** Linha de pagamento para o painel admin. */
interface AdminPaymentRow {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  provider: string | null;
  user: { name: string | null; email: string } | null;
}

export const metadata: Metadata = {
  title: "Assinaturas — Inst Acessor",
  description: "Planos, assinaturas, pagamentos e status da integração de pagamento.",
};

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Mascara IDs externos (Asaas) para não expor o valor completo no painel. */
function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return "••••" + id.slice(-4);
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export default async function AdminSubscriptionsPage() {
  await requireAdminSession();

  const billing = infinitepayStatus();

  const subscriptions = (await (
    bll.subscription.findMany as unknown as (args: unknown) => Promise<AdminSubscriptionRow[]>
  )({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true, priceCents: true } },
    },
  }));

  const payments = (await (
    bll.payment.findMany as unknown as (args: unknown) => Promise<AdminPaymentRow[]>
  )({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
    },
  }));

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + p.amountCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <CreditCard size={26} className="text-purple" />
          Assinaturas
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Planos, assinaturas e pagamentos. Valores reais em centavos.
        </p>
      </div>

      {/* Status da integração de pagamento (sem revelar valores/chaves) */}
      <SectionCard title="Integração de pagamento" className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 " +
                (billing.configured ? "bg-success-soft text-success" : "bg-surface text-ink-muted")
              }
            >
              <ShieldCheck size={20} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-semibold text-ink">InfinitePay</p>
              <p className="text-[12px] text-ink-muted">{billing.label}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <StatusBadge status={billing.checkoutsReady ? "ACTIVE" : "DISCONNECTED"} />
            <StatusBadge
              status={
                billing.webhookConfigured ? "CONNECTED" : "PENDING"
              }
            />
          </div>
        </div>
        <p className="text-[11.5px] text-ink-muted mt-3 border-t border-border-soft pt-3">
          Checkout oficial: links públicos do InfinitePay nos cards de planos. A liberação
          de acesso só ocorre após confirmação real do pagamento (webhook + payment_check).
          Nenhum valor de chave é exibido neste painel.
        </p>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard title="Assinaturas" className="p-5">
          <p className="font-data text-[32px] font-bold text-ink">{subscriptions.length}</p>
        </SectionCard>
        <SectionCard title="Total pago" className="p-5">
          <p className="font-data text-[32px] font-bold text-purple">{brl.format(totalPaid / 100)}</p>
        </SectionCard>
        <SectionCard title="Pagamentos" className="p-5">
          <p className="font-data text-[32px] font-bold text-ink">{payments.length}</p>
        </SectionCard>
      </div>

      <SectionCard
        title="Assinaturas"
        description="Últimas 100 assinaturas. IDs externos aparecem mascarados."
      >
        {subscriptions.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nenhuma assinatura ainda" description="As assinaturas aparecerão aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                  <th className="py-2.5 pr-4 font-semibold">Usuário</th>
                  <th className="py-2.5 pr-4 font-semibold">Plano</th>
                  <th className="py-2.5 pr-4 font-semibold">Valor cobrado</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Origem</th>
                  <th className="py-2.5 pr-4 font-semibold">Provider</th>
                  <th className="py-2.5 pr-4 font-semibold">Início</th>
                  <th className="py-2.5 pr-4 font-semibold">Expira</th>
                  <th className="py-2.5 pr-4 font-semibold">Pago em</th>
                  <th className="py-2.5 pr-4 font-semibold">Renovação</th>
                  <th className="py-2.5 font-semibold">IDs externos</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-b border-border-soft/60 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink">{s.user?.name ?? "—"}</p>
                      <p className="text-[12px] text-ink-muted">{s.user?.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink">{s.plan?.name ?? "—"}</p>
                      {s.plan?.priceCents != null && (
                        <p className="text-[12px] text-ink-muted">{brl.format(s.plan.priceCents / 100)}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-data font-semibold text-ink">
                      {s.amountCents != null ? brl.format(s.amountCents / 100) : "—"}
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                    <td className="py-3 pr-4">
                      {s.accessSource === "ADMIN_MANUAL" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple/10 px-2 py-0.5 text-[11.5px] font-medium text-purple">
                          Manual
                        </span>
                      ) : s.accessSource === INFINITEPAY_SOURCE ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-medium text-success">
                          InfinitePay
                        </span>
                      ) : s.accessSource === "ASAAS" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink-muted/10 px-2 py-0.5 text-[11.5px] font-medium text-ink-soft">
                          Asaas (legado)
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{s.provider ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-muted">{fmtDate(s.startAt)}</td>
                    <td className="py-3 pr-4 text-ink-muted">{fmtDate(s.expiresAt)}</td>
                    <td className="py-3 pr-4 text-ink-muted">{fmtDate(s.paidAt)}</td>
                    <td className="py-3">
                      {s.autoRenew ? (
                        <StatusBadge status="ACTIVE" />
                      ) : (
                        <span className="text-[12px] text-ink-muted">Manual</span>
                      )}
                    </td>
                    <td className="py-3 text-[11.5px] text-ink-muted">
                      {s.accessSource === "ADMIN_MANUAL" && s.grantedByAdminId && (
                        <p>Admin: {maskId(s.grantedByAdminId)}</p>
                      )}
                      <p>C: {maskId(s.externalCustomerId)}</p>
                      <p>S: {maskId(s.externalSubscriptionId)}</p>
                      <p>P: {maskId(s.externalPaymentId)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Pagamentos"
        description="Últimos 50 pagamentos."
      >
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nenhum pagamento ainda" description="Os pagamentos aparecerão aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                  <th className="py-2.5 pr-4 font-semibold">Usuário</th>
                  <th className="py-2.5 pr-4 font-semibold">Valor</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Provider</th>
                  <th className="py-2.5 pr-4 font-semibold">Pago em</th>
                  <th className="py-2.5 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-soft/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-ink">
                      {p.user?.name ?? p.user?.email ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-data font-semibold text-ink">
                      {brl.format(p.amountCents / 100)}
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 pr-4 text-ink-soft">{p.provider ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-muted">{fmtDate(p.paidAt)}</td>
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
