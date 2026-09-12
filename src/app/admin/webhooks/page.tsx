import type { Metadata } from "next";
import { headers } from "next/headers";
import { Webhook, ShieldCheck } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { bll } from "@/lib/billing/db";
import { infinitepayStatus } from "@/lib/billing/infinitepay/config";
import { INFINITEPAY_PROVIDER } from "@/lib/billing/infinitepay/events";
import { OFFICIAL_SITE_URL } from "@/lib/config/site";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyUrlButton } from "@/components/admin/webhooks-copy-button";

export const metadata: Metadata = {
  title: "Webhooks — Inst Acessor",
  description: "Status dos webhooks de pagamento e plataformas.",
};

export const dynamic = "force-dynamic";

/** URL de produção do webhook InfinitePay (oficial). */
const INFINITEPAY_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/infinitepay`;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminWebhooksPage() {
  await requireAdminSession();

  const ip = infinitepayStatus();

  // URL do ambiente atual (sem hardcode de host do Preview — vem do request).
  let currentEnvUrl = INFINITEPAY_PROD_URL;
  try {
    const h = headers();
    const host = h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") === "http" ? "http" : "https";
      currentEnvUrl = `${proto}://${host}/api/webhooks/infinitepay`;
    }
  } catch {
    // Sem acesso aos headers (build estático) → mantém a URL de produção.
  }

  // Últimos eventos reais do webhook InfinitePay (somente dados reais).
  const recentEvents = (await (
    bll.billingEvent.findMany as unknown as (args: unknown) => Promise<
      Array<{
        id: string;
        eventId: string;
        type: string;
        processed: boolean;
        createdAt: Date;
      }>
    >
  )({
    where: { provider: INFINITEPAY_PROVIDER },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, eventId: true, type: true, processed: true, createdAt: true },
  }));

  const totalEvents = recentEvents.length;
  const confirmedEvents = recentEvents.filter(
    (e) => e.type.includes("CONFIRMED") || e.processed
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Webhook size={26} className="text-purple" />
          Webhooks
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Endpoints de notificação e status de configuração. Nenhum segredo é exibido.
        </p>
      </div>

      {/* InfinitePay — webhook de pagamento */}
      <SectionCard
        title="InfinitePay — pagamento"
        description="Recebe notificações de pagamento do checkout oficial. A liberação de acesso só ocorre após validação real (payment_check) — nunca por um POST isolado."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 " +
                  (ip.configured ? "bg-success-soft text-success" : "bg-surface text-ink-muted")
                }
              >
                <ShieldCheck size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-semibold text-ink">InfinitePay</p>
                <p className="text-[12px] text-ink-muted">{ip.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <StatusBadge status={ip.configured ? "ACTIVE" : "DISCONNECTED"} />
              <StatusBadge status={ip.webhookConfigured ? "CONNECTED" : "PENDING"} />
            </div>
          </div>

          {/* URLs */}
          <div className="flex flex-col gap-2 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  Produção (oficial)
                </p>
                <p className="font-data text-[12.5px] text-ink truncate">{INFINITEPAY_PROD_URL}</p>
              </div>
              <CopyUrlButton url={INFINITEPAY_PROD_URL} />
            </div>
            <div className="h-px bg-border-soft/70" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  Ambiente atual
                </p>
                <p className="font-data text-[12.5px] text-ink truncate">{currentEnvUrl}</p>
              </div>
              <CopyUrlButton url={currentEnvUrl} />
            </div>
          </div>

          <p className="text-[11.5px] text-ink-muted border-t border-border-soft pt-3">
            Autenticação de webhook: o mecanismo oficial do InfinitePay ainda será
            confirmado na documentação. Enquanto isso, a segurança depende de validação
            de formato + referência estável + confirmação server-side (payment_check).
            Nenhum valor de chave é exibido neste painel.
          </p>
        </div>
      </SectionCard>

      {/* Últimos eventos recebidos (somente dados reais) */}
      <SectionCard
        title="Últimos eventos recebidos"
        description="Eventos do webhook InfinitePay persistidos no banco. Contadores só refletem eventos reais."
      >
        {totalEvents === 0 ? (
          <EmptyState
            icon={Webhook}
            title="Nenhum evento recebido ainda"
            description="Quando o InfinitePay enviar notificações, elas aparecerão aqui."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
                <p className="font-data text-[24px] font-bold text-ink">{totalEvents}</p>
                <p className="text-[12px] text-ink-muted">Eventos recebidos</p>
              </div>
              <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
                <p className="font-data text-[24px] font-bold text-success">{confirmedEvents}</p>
                <p className="text-[12px] text-ink-muted">Processados</p>
              </div>
              <div className="rounded-[11px] border border-border-soft bg-surface/50 px-4 py-3">
                <p className="font-data text-[24px] font-bold text-ink">{totalEvents - confirmedEvents}</p>
                <p className="text-[12px] text-ink-muted">Pendentes / ignorados</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                    <th className="py-2.5 pr-4 font-semibold">Evento</th>
                    <th className="py-2.5 pr-4 font-semibold">Tipo</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Recebido em</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e) => (
                    <tr key={e.id} className="border-b border-border-soft/60 last:border-0">
                      <td className="py-3 pr-4 font-data text-[12px] text-ink-soft truncate max-w-[260px]">
                        {e.eventId}
                      </td>
                      <td className="py-3 pr-4 text-ink">{e.type}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={e.processed ? "CONNECTED" : "PENDING"} />
                      </td>
                      <td className="py-3 text-ink-muted">{fmtDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
