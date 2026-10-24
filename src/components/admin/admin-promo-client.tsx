"use client";

import * as React from "react";
import { Loader2, Save, RotateCcw, AlertTriangle, Tag, Info } from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { PLAN_CATALOG, isLegacyPlan } from "@/lib/billing/plans/catalog";
import { formatBRL } from "@/lib/billing/plans/display";
import {
  planPromoDisplay,
  type PlanPromoEntry,
  type PromoConfig,
} from "@/lib/billing/promo";

/**
 * PRÉ-VENDA — PAINEL DO ADMIN (PARTES 17–19, adaptado aos 6+2 planos)
 * ===================================================================
 * Edita a configuração que o SERVIDOR usa para decidir o preço. Cobre TODOS os
 * slugs do catálogo (6 vendáveis + 2 legados), cada um com sua entrada unificada
 * (`config.plans[slug]`).
 *
 * Regras de honestidade visíveis:
 *
 *  1. A PRÉVIA usa a MESMA função pura do checkout (`planPromoDisplay`), calculada
 *     a partir da config atual — o que o admin vê é o que o cliente verá.
 *  2. Um preço promocional que NÃO seja desconto é sinalizado aqui e RECUSADO
 *     pelo servidor no Salvar (nunca anunciamos um desconto que não existe).
 *  3. O countdown é um PRAZO REAL. Vencido, ele desliga a promoção, e a prévia
 *     mostra isso antes de o cliente ver.
 *  4. Cada plano liga/desliga a pré-venda individualmente, além da chave geral.
 */

interface Countdown {
  running: boolean;
  text: string | null;
}

/** Converte "45,90" | "45.90" | "4590" em centavos. `null` quando não é número. */
function parseMoneyToCents(input: string): number | null {
  const clean = input.trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  // Aceita vírgula como decimal (padrão pt-BR).
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Campo de dinheiro com rótulo e ajuda. */
function MoneyField({
  label,
  hint,
  value,
  onChange,
  disabled,
  invalid,
}: {
  label: string;
  hint: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[12.5px] font-semibold text-ink-soft">{label}</span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-[10px] border bg-card px-3 py-2 focus-within:border-purple/40",
          invalid ? "border-danger/50" : "border-border-soft"
        )}
      >
        <span className="text-[12.5px] text-ink-muted flex-none">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-data text-ink outline-none disabled:text-ink-muted"
        />
      </div>
      <span className="text-[11.5px] text-ink-muted leading-relaxed">{hint}</span>
    </label>
  );
}

/** Interruptor simples (sem dependência externa). */
function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-purple"
      />
      <span className="text-[13px] text-ink">{label}</span>
    </label>
  );
}

/** Rótulo de cobrança conforme o ciclo ("cobranças" mensal, "anos" anual). */
function chargeWord(interval: string | null): string {
  return interval === "YEAR" ? "ano" : "cobrança";
}

export function AdminPromoClient({
  initialConfig,
  initialCountdown,
  defaultConfig,
}: {
  initialConfig: PromoConfig;
  initialCountdown: Countdown;
  defaultConfig: PromoConfig;
}) {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<PromoConfig>(initialConfig);
  const [countdown, setCountdown] = React.useState<Countdown>(initialCountdown);
  const [busy, setBusy] = React.useState(false);

  const set = (patch: Partial<PromoConfig>) => setConfig((c) => ({ ...c, ...patch }));

  /**
   * Atualiza a entrada UNIFICADA de um plano e espelha nos campos LEGADOS
   * (semanal/mensal/anual) quando for um deles — assim nenhuma leitura antiga vê
   * um valor diferente do que o painel mostra.
   */
  const setPlanEntry = (slug: string, patch: Partial<PlanPromoEntry>) => {
    setConfig((c) => {
      const current: PlanPromoEntry = c.plans[slug] ?? {
        enabled: false,
        promoPriceCents: 0,
        chargesAtPromoPrice: null,
        requiresNoPreviousPurchase: false,
      };
      const next = { ...current, ...patch };
      const plans = { ...c.plans, [slug]: next };
      const out: PromoConfig = { ...c, plans };
      if (slug === "semanal") {
        out.semanal = {
          enabled: next.enabled,
          promoPriceCents: next.promoPriceCents,
          requiresNoPreviousPurchase: next.requiresNoPreviousPurchase,
        };
      } else if (slug === "mensal") {
        out.mensal = {
          enabled: next.enabled,
          promoPriceCents: next.promoPriceCents,
          chargesAtPromoPrice: next.chargesAtPromoPrice ?? 1,
        };
      } else if (slug === "anual") {
        out.anual = {
          enabled: next.enabled,
          promoPriceCents: next.promoPriceCents,
          yearsAtPromoPrice: next.chargesAtPromoPrice ?? 1,
        };
      }
      return out;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        config?: PromoConfig;
        countdown?: Countdown;
      };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      // O servidor devolve o que REALMENTE ficou gravado. Adotamos isso como
      // estado — se ele normalizou algo, o admin vê na hora.
      if (data.config) setConfig(data.config);
      if (data.countdown) setCountdown(data.countdown);
      toast("Pré-venda salva.", "success");
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = () => {
    setConfig(defaultConfig);
    toast("Valores padrão carregados. Clique em Salvar para aplicar.", "info");
  };

  // Data do countdown em `datetime-local` (o input não aceita ISO com "Z").
  const endsAtLocal = React.useMemo(() => {
    if (!config.countdown.endsAt) return "";
    const d = new Date(config.countdown.endsAt);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [config.countdown.endsAt]);

  const countdownExpired = config.countdown.active && !countdown.running;

  // Prévia LOCAL, calculada a partir da config atual com a MESMA função do
  // checkout (`planPromoDisplay`) — atualiza a cada edição, sem ida ao servidor.
  const now = new Date().toISOString();
  const ordered = React.useMemo(
    () =>
      [...PLAN_CATALOG].sort((a, b) => {
        const la = isLegacyPlan(a.slug) ? 1 : 0;
        const lb = isLegacyPlan(b.slug) ? 1 : 0;
        if (la !== lb) return la - lb;
        return a.sortOrder - b.sortOrder;
      }),
    []
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso de prazo vencido — a promoção está DESLIGADA agora. */}
      {countdownExpired && (
        <div className="rounded-md bg-warn-soft border border-warn/20 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-none mt-0.5 text-warn" />
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            O countdown está ativo mas a data já passou.{" "}
            <b className="text-ink">O preço promocional não está sendo aplicado</b>{" "}
            — o servidor cobra o valor cheio. Ajuste a data ou desligue o
            countdown para a promoção valer novamente.
          </p>
        </div>
      )}

      <SectionCard
        title="Promoção"
        description="Desligue aqui para suspender toda a pré-venda, em todos os planos."
        className="p-5"
      >
        <div className="flex flex-col gap-3">
          <Toggle
            checked={config.enabled}
            onChange={(v) => set({ enabled: v })}
            label="Pré-venda ativa"
          />
          {!config.enabled && (
            <p className="text-[12px] text-ink-muted">
              Com a pré-venda desligada, os clientes pagam o valor cheio do plano.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ---------------- PLANO A PLANO (8 slugs) ---------------- */}
      {ordered.map((plan) => {
        const slug = plan.slug;
        const legacy = isLegacyPlan(slug);
        const entry: PlanPromoEntry = config.plans[slug] ?? {
          enabled: false,
          promoPriceCents: 0,
          chargesAtPromoPrice: null,
          requiresNoPreviousPurchase: false,
        };
        const defaultEntry = defaultConfig.plans[slug];
        const isOneTime = plan.type === "ONE_TIME";
        const disabled = !config.enabled || !entry.enabled;

        // Só recusa/exibe erro quando a entrada ESTÁ ligada (uma entry
        // desligada com preço igual ao cheio é simplesmente "sem promoção").
        const isInvalid = entry.enabled && entry.promoPriceCents >= plan.priceCents;

        // Prévia pelo servidor-equivalente (pura): mostra o que o card mostrará.
        const showcase = planPromoDisplay({
          slug,
          basePriceCents: plan.priceCents,
          config,
          now,
        });

        return (
          <SectionCard
            key={slug}
            title={
              <span className="flex items-center gap-2">
                {plan.name}
                {legacy && (
                  <Badge tone="warning" size="xs">
                    Legado
                  </Badge>
                )}
                {isOneTime ? (
                  <Badge tone="neutral" size="xs">
                    Pagamento único
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="xs">
                    {plan.billingInterval === "YEAR" ? "Recorrente anual" : "Recorrente mensal"}
                  </Badge>
                )}
              </span>
            }
            description={
              isOneTime
                ? "Compra única. A condição vale apenas na primeira compra."
                : "Assinatura recorrente. O desconto vale nas primeiras cobranças."
            }
            className="p-5"
          >
            <div className="flex flex-col gap-4">
              <Toggle
                checked={entry.enabled}
                onChange={(v) => setPlanEntry(slug, { enabled: v })}
                label="Aplicar pré-venda neste plano"
                disabled={!config.enabled}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  label="Preço promocional"
                  hint={
                    <>
                      Padrão {formatBRL(defaultEntry?.promoPriceCents ?? plan.priceCents)} ·
                      cheio {formatBRL(plan.priceCents)}
                    </>
                  }
                  value={centsToInput(entry.promoPriceCents)}
                  disabled={disabled}
                  invalid={isInvalid}
                  onChange={(v) => {
                    const cents = parseMoneyToCents(v);
                    if (cents != null) setPlanEntry(slug, { promoPriceCents: cents });
                  }}
                />

                {isOneTime ? (
                  <div className="flex items-end pb-1">
                    <Toggle
                      checked={entry.requiresNoPreviousPurchase}
                      onChange={(v) =>
                        setPlanEntry(slug, { requiresNoPreviousPurchase: v })
                      }
                      label="Somente na primeira compra"
                      disabled={disabled}
                    />
                  </div>
                ) : (
                  <label className="flex flex-col gap-1 min-w-0">
                    <span className="text-[12.5px] font-semibold text-ink-soft">
                      {plan.billingInterval === "YEAR"
                        ? "Anos com desconto"
                        : "Cobranças com desconto"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={plan.billingInterval === "YEAR" ? 10 : 24}
                      value={entry.chargesAtPromoPrice ?? ""}
                      disabled={disabled}
                      placeholder="1"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw.trim() === "") {
                          setPlanEntry(slug, { chargesAtPromoPrice: null });
                          return;
                        }
                        const n = Number(raw);
                        if (Number.isInteger(n) && n > 0) {
                          setPlanEntry(slug, { chargesAtPromoPrice: n });
                        }
                      }}
                      className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] font-data text-ink outline-none focus:border-purple/40 disabled:text-ink-muted"
                    />
                    <span className="text-[11.5px] text-ink-muted leading-relaxed">
                      Deixe 1 (ou vazio) para valer só na 1ª {chargeWord(plan.billingInterval)}.
                      Da {chargeWord(plan.billingInterval)} seguinte em diante vale o preço cheio.
                    </span>
                  </label>
                )}
              </div>

              {isInvalid && entry.enabled && (
                <div className="rounded-md bg-danger-softMid border border-danger/20 px-3.5 py-2.5 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="flex-none mt-0.5 text-danger" />
                  <p className="text-[12px] text-ink-soft leading-relaxed">
                    O preço promocional é{" "}
                    <b className="text-ink">maior ou igual ao cheio</b> — não é
                    desconto. O servidor vai RECUSAR este valor ao salvar. Use um
                    valor menor que {formatBRL(plan.priceCents)}.
                  </p>
                </div>
              )}

              {/* Prévia fiel do que será cobrado neste plano. */}
              <div className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide">
                  Prévia
                </span>
                <span className="text-[13px] font-data text-ink-muted line-through">
                  {formatBRL(plan.priceCents)}
                </span>
                {showcase.showPromo && showcase.promoPriceCents != null ? (
                  <>
                    <span className="text-[15px] font-data font-bold text-ink">
                      {formatBRL(showcase.promoPriceCents)}
                    </span>
                    <Badge tone="brand" size="xs">
                      <Tag size={10} />
                      −{showcase.discountPercent}%
                    </Badge>
                    {showcase.qualifier && (
                      <span className="text-[12px] text-ink-soft">
                        {showcase.qualifier}
                      </span>
                    )}
                    {showcase.afterText && (
                      <span className="text-[12px] text-ink-muted">
                        · {showcase.afterText}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[12.5px] text-ink-muted">
                    Sem promoção — o card mostra apenas {formatBRL(plan.priceCents)}.
                  </span>
                )}
              </div>
            </div>
          </SectionCard>
        );
      })}

      {/* ---------------- COUNTDOWN ---------------- */}
      <SectionCard
        title="Countdown"
        description="Prazo real avaliado pelo servidor. Vencido, a promoção para de valer."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={config.countdown.active}
            onChange={(v) => set({ countdown: { ...config.countdown, active: v } })}
            label="Mostrar e respeitar o countdown"
            disabled={!config.enabled}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                Termina em
              </span>
              <input
                type="datetime-local"
                value={endsAtLocal}
                disabled={!config.enabled || !config.countdown.active}
                onChange={(e) => {
                  const v = e.target.value;
                  const iso = v ? new Date(v).toISOString() : null;
                  set({ countdown: { ...config.countdown, endsAt: iso } });
                }}
                className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] font-data text-ink outline-none focus:border-purple/40 disabled:text-ink-muted"
              />
              <span className="text-[11.5px] text-ink-muted leading-relaxed">
                {countdown.running && countdown.text
                  ? `Em andamento — termina em ${countdown.text}.`
                  : config.countdown.endsAt
                    ? "Data já passada: a promoção está suspensa."
                    : "Sem data definida: o countdown não aparece e a promoção segue até ser desligada."}
              </span>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                Rótulo exibido
              </span>
              <input
                type="text"
                maxLength={80}
                value={config.countdown.label}
                disabled={!config.enabled}
                onChange={(e) =>
                  set({ countdown: { ...config.countdown, label: e.target.value } })
                }
                className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-purple/40 disabled:text-ink-muted"
              />
              <span className="text-[11.5px] text-ink-muted leading-relaxed">
                Máximo de 80 caracteres.
              </span>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Como o preço é decidido"
        description="Calculado pelo servidor com as mesmas regras que o checkout usa para cobrar."
        className="p-5"
      >
        <div className="flex items-start gap-2.5 rounded-[12px] bg-surface/40 border border-border-soft px-4 py-3">
          <Info size={15} className="flex-none mt-0.5 text-ink-muted" />
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Esta prévia não considera o histórico de cada comprador (a elegibilidade
            individual — primeira compra, cobranças já usadas — só o checkout
            decide). Um preço promocional maior ou igual ao cheio é recusado ao
            salvar. Alterações valem para os próximos checkouts.
          </p>
        </div>
      </SectionCard>

      {/* ---------------- AÇÕES ---------------- */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Salvando…" : "Salvar pré-venda"}
        </Button>
        <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={busy}>
          <RotateCcw size={14} />
          Restaurar padrão
        </Button>
        <span className="text-[12px] text-ink-muted">
          Cobre os 8 planos do catálogo. As alterações valem para os próximos checkouts.
        </span>
      </div>
    </div>
  );
}
