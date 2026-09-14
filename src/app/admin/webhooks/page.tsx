import type { Metadata } from "next";
import { headers } from "next/headers";
import { Webhook, ShieldCheck } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { bll } from "@/lib/billing/db";
import { asaasStatus } from "@/lib/billing/asaas/config";
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

/** URLs de produção dos webhooks. Asaas = gateway oficial. */
const ASAAS_PROD_URL = `${OFFICIAL_SITE_URL}/api/webhooks/asaas`;
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

/**
 * Mascara o identificador externo antes de exibir no painel.
 * O `eventId` persistido é `<EVENTO>:<id-externo>` — o ID cru do Asaas não
 * precisa aparecer inteiro para o painel cumprir sua função.
 */
function maskExternalId(value: string): string {
  const parts = value.split(":");
  const id = parts.length > 1 ? parts.slice(1).join(":") : value;
  if (id.length <= 8) return "••••" + id.slice(-4);
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * Separa o nome oficial do evento do identificador externo.
 * `PAYMENT_CONFIRMED:pay_123` → { type: "PAYMENT_CONFIRMED", external: "pay_123" }.
 */
function splitEventId(value: string): { type: string; external: string | null } {
  const idx = value.indexOf(":");
  if (idx === -1) return { type: value, external: null };
  return { type: value.slice(0, idx), external: value.slice(idx + 1) };
}

/** Objeto ao qual o evento se refere, derivado do próprio nome oficial. */
function eventSubject(type: string): "Pagamento" | "Assinatura" | "Checkout" | "—" {
  if (type.startsWith("PAYMENT_")) return "Pagamento";
  if (type.startsWith("SUBSCRIPTION_")) return "Assinatura";
  if (type.startsWith("CHECKOUT_")) return "Checkout";
  return "—";
}

/** Resultado objetivo do evento, a partir do estado persistido. */
function eventResult(processed: boolean): string {
  return processed ? "Processado" : "Pendente / não aplicado";
}

/**
 * Veredito de formato do `authToken` do webhook — o Asaas exige 32 a 255
 * caracteres, sem espaços, e o valor NÃO pode ser a API Key. Exibimos apenas o
 * veredito: o valor do token nunca entra no painel.
 */
function tokenFormatLabel(
  issue: "ausente" | "formato_invalido" | "igual_api_key" | "ok"
): string {
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

export default async function AdminWebhooksPage() {
  await requireAdminSession();

  // GATEWAY OFICIAL = ASAAS. O status vem de `asaasStatus()` (env do servidor,
  // somente rótulos — nunca chaves). O InfinitePay aparece apenas como
  // HISTÓRICO, para leitura dos eventos já recebidos.
  const asaas = asaasStatus();
  const ip = infinitepayStatus();

  // URLs do ambiente atual (sem hardcode de host do Preview — vem do request).
  let asaasEnvUrl = ASAAS_PROD_URL;
  let ipEnvUrl = INFINITEPAY_PROD_URL;
  try {
    const h = headers();
    const host = h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") === "http" ? "http" : "https";
      asaasEnvUrl = `${proto}://${host}/api/webhooks/asaas`;
      ipEnvUrl = `${proto}://${host}/api/webhooks/infinitepay`;
    }
  } catch {
    // Sem acesso aos headers (build estático) → mantém as URLs de produção.
  }

  // Últimos eventos reais de webhook — Asaas (oficial) + InfinitePay
  // (histórico). Somente dados reais; nenhum contador é estimado.
  const recentEvents = (await (
    bll.billingEvent.findMany as unknown as (args: unknown) => Promise<
      Array<{
        id: string;
        eventId: string;
        type: string;
        provider: string | null;
        processed: boolean;
        createdAt: Date;
      }>
    >
  )({
    where: { provider: { in: ["asaas", INFINITEPAY_PROVIDER] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, eventId: true, type: true, provider: true, processed: true, createdAt: true },
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

      {/* ASAAS — webhook do gateway oficial */}
      <SectionCard
        title="Asaas — pagamentos e assinaturas"
        description="Webhook do gateway oficial. É o único caminho que libera acesso: a confirmação real do pagamento chega por aqui, é registrada e então o acesso é concedido. Um redirect do checkout não prova pagamento."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 " +
                  (asaas.configured ? "bg-success-soft text-success" : "bg-surface text-ink-muted")
                }
              >
                <ShieldCheck size={20} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-semibold text-ink flex flex-wrap items-center gap-2">
                  Asaas
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple bg-ai-soft rounded-pill px-2 py-0.5">
                    Gateway oficial
                  </span>
                </p>
                <p className="text-[12px] text-ink-muted">{asaas.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <StatusBadge status={asaas.configured ? "ACTIVE" : "DISCONNECTED"} />
              <StatusBadge status={asaas.webhookConfigured ? "CONNECTED" : "PENDING"} />
            </div>
          </div>

          {/* URLs */}
          <div className="flex flex-col gap-2 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  Produção (oficial)
                </p>
                <p className="font-data text-[12.5px] text-ink truncate">{ASAAS_PROD_URL}</p>
              </div>
              <CopyUrlButton url={ASAAS_PROD_URL} />
            </div>
            <div className="h-px bg-border-soft/70" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                  Ambiente atual
                </p>
                <p className="font-data text-[12.5px] text-ink truncate">{asaasEnvUrl}</p>
              </div>
              <CopyUrlButton url={asaasEnvUrl} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border-soft pt-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Autenticação
              </p>
              <p className="font-data text-[12.5px] text-ink">asaas-access-token</p>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Token (formato)
              </p>
              <p className="text-[12.5px] text-ink-soft">
                {tokenFormatLabel(asaas.webhookTokenIssue)}
              </p>
            </div>
            <p className="text-[11.5px] text-ink-muted">
              Token compartilhado enviado pelo Asaas no header{" "}
              <code className="font-data">asaas-access-token</code> e comparado no servidor
              em tempo constante contra a variável <code className="font-data">ASAAS_WEBHOOK_TOKEN</code>.
              Não use a API Key do Asaas como esse token. Sem o token configurado o endpoint
              responde 503 e NÃO processa o evento (fail-closed). Eventos repetidos são
              ignorados por idempotência (mesmo ID de evento). Nenhum valor de token é
              exibido neste painel.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* InfinitePay — HISTÓRICO (fora dos fluxos ativos) */}
      <SectionCard
        title="InfinitePay — histórico"
        description="Gateway anterior, fora dos fluxos ativos. O endpoint segue no ar apenas para não perder eventos antigos e manter o histórico consistente com os registros do banco."
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

          {/* URL histórica */}
          <div className="flex items-center justify-between gap-3 rounded-[11px] border border-border-soft bg-surface/40 p-4">
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-muted">
                Endpoint histórico
              </p>
              <p className="font-data text-[12.5px] text-ink truncate">{ipEnvUrl}</p>
            </div>
            <CopyUrlButton url={ipEnvUrl} />
          </div>
        </div>
      </SectionCard>

      {/* Últimos eventos recebidos (somente dados reais) */}
      <SectionCard
        title="Últimos eventos recebidos"
        description="Eventos de webhook persistidos no banco (Asaas e InfinitePay histórico). Contadores só refletem eventos reais."
      >
        {totalEvents === 0 ? (
          <EmptyState
            icon={Webhook}
            title="Nenhum evento recebido ainda"
            description="Quando o Asaas enviar notificações, elas aparecerão aqui."
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
                    // O `eventId` persistido é `<EVENTO>:<id>`; o tipo real do
                    // evento é a parte antes dos dois-pontos.
                    const split = splitEventId(e.eventId);
                    const type = split.type || e.type;
                    return (
                      <tr key={e.id} className="border-b border-border-soft/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-data text-[12.5px] text-ink font-semibold">
                            {type}
                          </p>
                          <p className="text-[11.5px] text-ink-muted">
                            {eventResult(e.processed)}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-ink-soft">{eventSubject(type)}</td>
                        <td className="py-3 pr-4 text-ink-soft">
                          {e.provider === "asaas" ? "Asaas" : "InfinitePay (histórico)"}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={e.processed ? "CONNECTED" : "PENDING"} />
                        </td>
                        <td className="py-3 pr-4 font-data text-[12px] text-ink-muted">
                          {split.external ? maskExternalId(split.external) : "—"}
                        </td>
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
