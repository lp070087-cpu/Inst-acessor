import type { Metadata } from "next";
import { headers } from "next/headers";
import { Webhook, ShieldCheck, AlertTriangle } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { bll } from "@/lib/billing/db";
import { asaasStatus } from "@/lib/billing/asaas/config";
import { infinitepayStatus } from "@/lib/billing/infinitepay/config";
import { getGatewayConfig } from "@/lib/billing/gateways/config";
import { INFINITEPAY_PROVIDER } from "@/lib/billing/infinitepay/events";
import { OFFICIAL_SITE_URL } from "@/lib/config/site";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyUrlButton } from "@/components/admin/webhooks-copy-button";
import { WebhooksCheckoutEditor } from "@/components/admin/webhooks-checkout-editor";

export const metadata: Metadata = {
  title: "Webhooks — Inst Acessor",
  description: "Status dos webhooks de pagamento e plataformas.",
};

export const dynamic = "force-dynamic";

/**
 * Endpoints FIXOS por arquitetura (não editáveis pelo usuário).
 * Alterar o path exigiria criar nova rota Next.js — nunca concatenar input.
 */
const ASAAS_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/asaas`;
const INFINITEPAY_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/infinitepay`;
const KIWIFY_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/kiwify`;
const KACTO_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/kacto`;

const KIWIFY_ENV_FALLBACK = KIWIFY_PROD_URL;
const KACTO_ENV_FALLBACK = KACTO_PROD_URL;

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

function maskExternalId(value: string): string {
  const parts = value.split(":");
  const id = parts.length > 1 ? parts.slice(1).join(":") : value;
  if (id.length <= 8) return "••••" + id.slice(-4);
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function splitEventId(value: string): { type: string; external: string | null } {
  const idx = value.indexOf(":");
  if (idx === -1) return { type: value, external: null };
  return { type: value.slice(0, idx), external: value.slice(idx + 1) };
}

function eventSubject(type: string): "Pagamento" | "Assinatura" | "Checkout" | "—" {
  if (type.startsWith("PAYMENT_")) return "Pagamento";
  if (type.startsWith("SUBSCRIPTION_")) return "Assinatura";
  if (type.startsWith("CHECKOUT_")) return "Checkout";
  return "—";
}

function eventResult(processed: boolean): string {
  return processed ? "Processado" : "Pendente / não aplicado";
}

function tokenFormatLabel(issue: "ausente" | "formato_invalido" | "igual_api_key" | "ok"): string {
  switch (issue) {
    case "ok":
      return "Formato válido";
    case "formato_invalido":
      return "Formato inválido (o Asaas exige 32 a 255 caracteres, sem espaços)";
    case "igual_api_key":
      return "Inválido: é igual à API Key (o token do webhook deve ser outro valor)";
    default:
      return "Não configurado";
  }
}

function providerLabel(provider: string | null): string {
  if (provider === "asaas") return "Asaas";
  if (provider === "kiwify") return "Kiwify";
  if (provider === "kacto") return "Kacto";
  if (provider === INFINITEPAY_PROVIDER || provider === "infinitepay") return "InfinitePay (histórico)";
  return provider ?? "—";
}

export default async function AdminWebhooksPage() {
  await requireAdminSession();

  const asaas = asaasStatus();
  const ip = infinitepayStatus();
  let gatewayCfg: Awaited<ReturnType<typeof getGatewayConfig>> | null = null;
  try {
    gatewayCfg = await getGatewayConfig();
  } catch {
    gatewayCfg = null;
  }
  const kiwifyEnabled = Boolean(gatewayCfg?.gateways?.kiwify?.enabled);
  const kactoEnabled = Boolean(gatewayCfg?.gateways?.kacto?.enabled);
  const checkoutUrls = (gatewayCfg?.checkoutUrls ?? {}) as Record<string, string>;

  let asaasEnvUrl = ASAAS_PROD_URL;
  let ipEnvUrl = INFINITEPAY_PROD_URL;
  let kiwifyEnvUrl = KIWIFY_PROD_URL;
  let kactoEnvUrl = KACTO_PROD_URL;
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") === "http" ? "http" : "https";
      asaasEnvUrl = `${proto}://${host}/api/webhooks/asaas`;
      ipEnvUrl = `${proto}://${host}/api/webhooks/infinitepay`;
      kiwifyEnvUrl = `${proto}://${host}/api/webhooks/kiwify`;
      kactoEnvUrl = `${proto}://${host}/api/webhooks/kacto`;
    }
  } catch {
    // build estático → mantém produção
  }

  const recentEvents = (await (
    bll.billingEvent.findMany as unknown as (args: unknown) => Promise<
      Array<{ id: string; eventId: string; type: string; provider: string | null; processed: boolean; createdAt: Date }>
    >
  )({
    where: { provider: { in: ["asaas", INFINITEPAY_PROVIDER, "kiwify", "kacto"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, eventId: true, type: true, provider: true, processed: true, createdAt: true },
  }));

  const totalEvents = recentEvents.length;
  const confirmedEvents = recentEvents.filter((e) => e.type.includes("CONFIRMED") || e.processed).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Webhook size={26} className="text-purple" />
          Webhooks
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Endpoints de notificação e status de configuração. O caminho <code className="font-data">/api/webhooks/…</code> é fixo por arquitetura e não é editável. Nenhum segredo é exibido.
        </p>
      </div>

      {/* ASAAS — gateway oficial */}
      <SectionCard
        title="Asaas — pagamentos e assinaturas"
        description="Webhook do gateway oficial. É o único caminho que libera acesso: a confirmação real do pagamento chega por aqui, é registrada e então o acesso é concedido. Um redirect do checkout não prova pagamento."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + (asaas.configured ? "bg-success-soft text-success" : "bg-surface text-ink-muted")}>
                <ShieldCheck size={20} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-semibold text-ink flex flex-wrap items-center gap-2">
                  Asaas
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple bg-ai-soft rounded-pill px-2 py-0.5">Gateway oficial</span>
                </p>
                <p className="text-[12px] text-ink-muted">{asaas.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <StatusBadge status={asaas.configured ? "ACTIVE" : "DISCONNECTED"} />
              <StatusBadge status={asaas.webhookConfigured ? "CONNECTED" : "PENDING"} />
              <Badge tone={asaas.environment === "production" ? "brand" : "neutral"}>{asaas.environment === "production" ? "Produção" : asaas.environment === "sandbox" ? "Sandbox" : "—"}</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Produção (oficial)</p>
                <p className="font-data text-[12.5px] text-ink truncate">{ASAAS_PROD_URL}</p>
              </div>
              <CopyUrlButton url={ASAAS_PROD_URL} />
            </div>
            <div className="h-px bg-border-soft/70" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Ambiente atual</p>
                <p className="font-data text-[12.5px] text-ink truncate">{asaasEnvUrl}</p>
              </div>
              <CopyUrlButton url={asaasEnvUrl} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border-soft pt-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Autenticação</p>
              <p className="font-data text-[12.5px] text-ink">asaas-access-token</p>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Token (formato)</p>
              <p className="text-[12.5px] text-ink-soft">{tokenFormatLabel(asaas.webhookTokenIssue)}</p>
            </div>
            <p className="text-[11.5px] text-ink-muted">
              Token compartilhado enviado pelo Asaas no header <code className="font-data">asaas-access-token</code> e comparado no servidor em tempo constante contra <code className="font-data">ASAAS_WEBHOOK_TOKEN</code>. Não use a API Key. Sem token, 503 (fail-closed). Idempotência por eventId. Nenhum valor de token exibido.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* KIWIFY — externo, pendente */}
      <SectionCard
        title="Kiwify — checkout externo"
        description="Gateway externo opcional. Endpoint fixo /api/webhooks/kiwify (não editável). Integração pendente até credenciais e verificação de assinatura serem confirmadas pela documentação oficial."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + (kiwifyEnabled ? "bg-ai-soft text-purple" : "bg-surface text-ink-muted")}>
                <Webhook size={18} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-semibold text-ink flex flex-wrap items-center gap-2">
                  Kiwify
                  <Badge tone={kiwifyEnabled ? "brand" : "warning"}>{kiwifyEnabled ? "Habilitado (pendente)" : "Desabilitado"}</Badge>
                </p>
                <p className="text-[12px] text-ink-muted flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" /> Integração pendente — credenciais não configuradas
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <StatusBadge status={kiwifyEnabled ? "CONNECTED" : "PENDING"} />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Endpoint (fixo, somente cópia)</p>
                <p className="font-data text-[12.5px] text-ink truncate">{KIWIFY_PROD_URL}</p>
              </div>
              <CopyUrlButton url={KIWIFY_PROD_URL} />
            </div>
            <div className="h-px bg-border-soft/70" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Ambiente atual</p>
                <p className="font-data text-[12.5px] text-ink truncate">{kiwifyEnvUrl || KIWIFY_ENV_FALLBACK}</p>
              </div>
              <CopyUrlButton url={kiwifyEnvUrl || KIWIFY_ENV_FALLBACK} />
            </div>
            <p className="text-[11.5px] text-ink-muted">Cole esta URL no painel da Kiwify (webhook). O caminho é fixo e não pode ser alterado por este painel.</p>
          </div>

          <div className="border-t border-border-soft pt-4">
            <p className="text-[13px] font-semibold text-ink mb-1">Checkout externo por plano (opcional)</p>
            <p className="text-[12.5px] text-ink-muted mb-3">URL do checkout hospedado na Kiwify quando o pagamento sair do Asaas. Deve ser https:// (max 500). Usada como redirect — validada no servidor.</p>
            <WebhooksCheckoutEditor initialCheckoutUrls={checkoutUrls} provider="kiwify" />
          </div>
        </div>
      </SectionCard>

      {/* KACTO — externo, pendente */}
      <SectionCard
        title="Kacto — checkout externo"
        description="Gateway externo opcional. Endpoint fixo /api/webhooks/kacto (não editável). Integração pendente até credenciais e verificação de assinatura serem confirmadas."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + (kactoEnabled ? "bg-ai-soft text-purple" : "bg-surface text-ink-muted")}>
                <Webhook size={18} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-semibold text-ink flex flex-wrap items-center gap-2">
                  Kacto
                  <Badge tone={kactoEnabled ? "brand" : "warning"}>{kactoEnabled ? "Habilitado (pendente)" : "Desabilitado"}</Badge>
                </p>
                <p className="text-[12px] text-ink-muted flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" /> Integração pendente — credenciais não configuradas
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <StatusBadge status={kactoEnabled ? "CONNECTED" : "PENDING"} />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Endpoint (fixo, somente cópia)</p>
                <p className="font-data text-[12.5px] text-ink truncate">{KACTO_PROD_URL}</p>
              </div>
              <CopyUrlButton url={KACTO_PROD_URL} />
            </div>
            <div className="h-px bg-border-soft/70" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Ambiente atual</p>
                <p className="font-data text-[12.5px] text-ink truncate">{kactoEnvUrl || KACTO_ENV_FALLBACK}</p>
              </div>
              <CopyUrlButton url={kactoEnvUrl || KACTO_ENV_FALLBACK} />
            </div>
            <p className="text-[11.5px] text-ink-muted">Cole esta URL no painel da Kacto (webhook). O caminho é fixo e não pode ser alterado por este painel.</p>
          </div>

          <div className="border-t border-border-soft pt-4">
            <p className="text-[13px] font-semibold text-ink mb-1">Checkout externo por plano (opcional)</p>
            <p className="text-[12.5px] text-ink-muted mb-3">URL do checkout hospedado na Kacto quando o pagamento sair do Asaas. Deve ser https:// (max 500). Usada como redirect — validada no servidor.</p>
            <WebhooksCheckoutEditor initialCheckoutUrls={checkoutUrls} provider="kacto" />
          </div>
        </div>
      </SectionCard>

      {/* InfinitePay — HISTÓRICO */}
      <SectionCard
        title="InfinitePay — histórico"
        description="Gateway anterior, fora dos fluxos ativos. O endpoint segue no ar apenas para não perder eventos antigos e manter o histórico consistente com os registros do banco."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + (ip.configured ? "bg-success-soft text-success" : "bg-surface text-ink-muted")}>
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

          <div className="flex items-center justify-between gap-3 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">Endpoint histórico</p>
              <p className="font-data text-[12.5px] text-ink truncate">{ipEnvUrl}</p>
            </div>
            <CopyUrlButton url={ipEnvUrl} />
          </div>
        </div>
      </SectionCard>

      {/* Últimos eventos */}
      <SectionCard
        title="Últimos eventos recebidos"
        description="Eventos de webhook persistidos no banco (Asaas, Kiwify, Kacto, InfinitePay histórico). Contadores só refletem eventos reais."
      >
        {totalEvents === 0 ? (
          <EmptyState icon={Webhook} title="Nenhum evento recebido ainda" description="Quando os gateways enviarem notificações, elas aparecerão aqui." />
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
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[820px] text-left text-[13.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-ink-muted border-b border-border-soft">
                    <th className="py-2.5 pr-4 font-semibold">Tipo</th>
                    <th className="py-2.5 pr-4 font-semibold">Objeto</th>
                    <th className="py-2.5 pr-4 font-semibold">Gateway</th>
                    <th className="py-2.5 pr-4 font-semibold">Resultado</th>
                    <th className="py-2.5 pr-4 font-semibold">ID externo</th>
                    <th className="py-2.5 font-semibold">Recebido em</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e) => {
                    const split = splitEventId(e.eventId);
                    const type = split.type || e.type;
                    return (
                      <tr key={e.id} className="border-b border-border-soft/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-data text-[12.5px] text-ink font-semibold">{type}</p>
                          <p className="text-[11.5px] text-ink-muted">{eventResult(e.processed)}</p>
                        </td>
                        <td className="py-3 pr-4 text-ink-soft">{eventSubject(type)}</td>
                        <td className="py-3 pr-4 text-ink-soft">{providerLabel(e.provider)}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={e.processed ? "CONNECTED" : "PENDING"} />
                        </td>
                        <td className="py-3 pr-4 font-data text-[12px] text-ink-muted">{split.external ? maskExternalId(split.external) : "—"}</td>
                        <td className="py-3 text-ink-muted">{fmtDate(e.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
