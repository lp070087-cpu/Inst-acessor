"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Info, Loader2, Save } from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import type { GatewayConfig, GatewayId } from "@/lib/billing/gateways/config";

type Availability = Record<GatewayId, boolean>;

interface Props {
  initialConfig: GatewayConfig;
  initialAvailability: Availability;
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function AdminGatewaysClient({ initialConfig, initialAvailability }: Props) {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<GatewayConfig>(initialConfig);
  const [availability, setAvailability] = React.useState<Availability>(initialAvailability);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // checkout url drafts locais
  const [urlDrafts, setUrlDrafts] = React.useState<Record<string, string>>(() => ({ ...initialConfig.checkoutUrls }));

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gateways");
      const data = (await res.json()) as { config?: GatewayConfig; availability?: Availability; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao recarregar");
      if (data.config) {
        setConfig(data.config);
        setUrlDrafts({ ...data.config.checkoutUrls });
      }
      if (data.availability) setAvailability(data.availability);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const toggleGateway = async (gateway: GatewayId, enabled: boolean) => {
    setBusy(`gw:${gateway}`);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-gateway", gateway, enabled }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: GatewayConfig; availability?: Availability };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível alterar o gateway.", "error");
        return;
      }
      if (data.config) {
        setConfig(data.config);
        setUrlDrafts({ ...data.config.checkoutUrls });
      }
      if (data.availability) setAvailability(data.availability);
      toast(enabled ? "Gateway ativado." : "Gateway desativado.", "success");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const togglePlanGateway = async (plan: string, gateway: GatewayId, checked: boolean) => {
    const current = config.plans[plan] ?? [];
    const next = checked ? [...new Set([...current, gateway])] : current.filter((g) => g !== gateway);
    if (next.length === 0) {
      toast("Deixe ao menos um gateway por plano.", "warning");
      return;
    }
    setBusy(`plan:${plan}:${gateway}`);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-plan-gateways", plan, gateways: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: GatewayConfig; availability?: Availability };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      if (data.config) {
        setConfig(data.config);
        setUrlDrafts({ ...data.config.checkoutUrls });
      }
      if (data.availability) setAvailability(data.availability);
      toast("Gateways do plano atualizados.", "success");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const toggleMethod = async (key: "pix" | "card" | "boleto", value: boolean) => {
    setBusy(`method:${key}`);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-methods", methods: { [key]: value } }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: GatewayConfig; availability?: Availability };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar método.", "error");
        return;
      }
      if (data.config) {
        setConfig(data.config);
        setUrlDrafts({ ...data.config.checkoutUrls });
      }
      if (data.availability) setAvailability(data.availability);
      toast("Métodos atualizados.", "success");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const saveCheckoutUrl = async (plan: string) => {
    const raw = (urlDrafts[plan] ?? "").trim();
    setBusy(`url:${plan}`);
    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-checkout-url", plan, checkoutUrl: raw }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; config?: GatewayConfig; availability?: Availability };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "URL inválida.", "error");
        return;
      }
      if (data.config) {
        setConfig(data.config);
        setUrlDrafts({ ...data.config.checkoutUrls });
      }
      if (data.availability) setAvailability(data.availability);
      toast(raw ? "Checkout externo salvo." : "Checkout externo removido.", "success");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(null);
    }
  };

  const gateways: GatewayId[] = ["asaas", "kiwify", "kacto"];

  return (
    <div className="flex flex-col gap-5">
      {/* Legacy notice */}
      <div className="rounded-md bg-warn-soft border border-warn/20 px-4 py-3 flex items-start gap-2.5">
        <Info size={16} className="flex-none mt-0.5 text-warn" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          <b className="text-ink">InfinitePay é legado</b> — preservado no código mas não recomendado.
          Use a configuração abaixo. O Asaas segue como gateway oficial.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-danger-softMid border border-danger/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-danger flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </p>
          <Button variant="ghost" size="xs" onClick={reload} disabled={loading}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Gateways */}
      <SectionCard
        title="Gateways"
        description="Ative apenas o gateway com credenciais configuradas. Kiwify/Kacto exigem credenciais documentadas."
        className="p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {gateways.map((id) => {
            const entry = config.gateways[id];
            const available = availability[id] ?? false;
            const isBusy = busy === `gw:${id}`;
            return (
              <div key={id} className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-purple" />
                  <p className="text-[13.5px] font-semibold text-ink">{entry.label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {available ? (
                    <Badge tone="success" size="xs" dot>
                      Disponível
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="xs" dot>
                      Configuração pendente
                    </Badge>
                  )}
                  {entry.enabled ? (
                    <Badge tone="brand" size="xs">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="xs">
                      Inativo
                    </Badge>
                  )}
                </div>
                <p className="text-[11.5px] text-ink-muted leading-relaxed">
                  {id === "asaas"
                    ? available
                      ? "Asaas configurado (ASAAS_API_KEY presente)."
                      : "Sem ASAAS_API_KEY — ative após configurar credenciais."
                    : "Aguardando credenciais documentadas. Ativação bloqueada."}
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    disabled={isBusy || loading}
                    onChange={(e) => void toggleGateway(id, e.target.checked)}
                    className="w-4 h-4 accent-purple"
                  />
                  <span className="text-[13px] text-ink">{entry.enabled ? "Ativo" : "Inativo"}</span>
                  {isBusy && <Loader2 size={14} className="animate-spin text-ink-muted" />}
                </label>
                {!available && entry.enabled && (
                  <p className="text-[11.5px] text-danger">Ativo sem credenciais — desative até configurar.</p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Per-plan gateways */}
      <SectionCard
        title="Gateways por plano"
        description="Quais gateways podem cobrar cada plano. Ao menos um por plano. Kiwify/Kacto só cobram via checkout externo enquanto não há integração."
        className="p-5"
      >
        <div className="flex flex-col gap-3">
          {PLAN_CATALOG.map((plan) => {
            const allowed = config.plans[plan.slug] ?? ["asaas"];
            return (
              <div
                key={plan.slug}
                className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-ink">{plan.name}</p>
                  <span className="text-[11.5px] text-ink-muted font-data">{plan.slug}</span>
                  <span className="text-[11.5px] text-ink-muted font-data">{brl(plan.priceCents)}</span>
                  {!plan.active && (
                    <Badge tone="neutral" size="xs">
                      Fora de venda
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4">
                  {gateways.map((id) => {
                    const checked = allowed.includes(id);
                    const isBusy = busy === `plan:${plan.slug}:${id}`;
                    return (
                      <label key={id} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isBusy || loading}
                          onChange={(e) => void togglePlanGateway(plan.slug, id, e.target.checked)}
                          className="w-4 h-4 accent-purple"
                        />
                        <span className="text-[13px] text-ink">{config.gateways[id].label}</span>
                        {isBusy && <Loader2 size={12} className="animate-spin text-ink-muted" />}
                      </label>
                    );
                  })}
                </div>

                {/* Checkout externo (Kiwify/Kacto) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-ink-soft flex items-center gap-1.5">
                    <ExternalLink size={12} /> Checkout externo (Kiwify/Kacto) — opcional
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={urlDrafts[plan.slug] ?? ""}
                      onChange={(e) => setUrlDrafts((d) => ({ ...d, [plan.slug]: e.target.value }))}
                      className="flex-1 min-w-0 rounded-[9px] border border-border-soft bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-purple/40"
                    />
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={busy === `url:${plan.slug}` || loading}
                      onClick={() => void saveCheckoutUrl(plan.slug)}
                    >
                      {busy === `url:${plan.slug}` ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Salvar URL
                    </Button>
                  </div>
                  {config.checkoutUrls[plan.slug] && (
                    <a
                      href={config.checkoutUrls[plan.slug]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11.5px] text-purple hover:underline break-all"
                    >
                      {config.checkoutUrls[plan.slug]}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Methods */}
      <SectionCard
        title="Métodos de pagamento"
        description="Aplicados no checkout hospedado (Asaas). Pix e cartão ligados por padrão."
        className="p-5"
      >
        <div className="flex flex-wrap gap-6">
          {(["pix", "card", "boleto"] as const).map((k) => {
            const label = k === "pix" ? "Pix" : k === "card" ? "Cartão" : "Boleto";
            const checked = config.methods[k];
            const isBusy = busy === `method:${k}`;
            return (
              <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBusy || loading}
                  onChange={(e) => void toggleMethod(k, e.target.checked)}
                  className="w-4 h-4 accent-purple"
                />
                <span className="text-[13px] text-ink">{label}</span>
                {isBusy && <Loader2 size={12} className="animate-spin text-ink-muted" />}
              </label>
            );
          })}
        </div>
      </SectionCard>

      <div className={cn("flex items-center gap-2 text-[12px] text-ink-muted", loading && "opacity-60")}>
        <CheckCircle2 size={14} className="text-success" />
        Alterações valem para os próximos checkouts. Gateways sem credenciais permanecem inativos.
      </div>
    </div>
  );
}
