"use client";

import * as React from "react";
import { Loader2, Save, RotateCcw, AlertTriangle, Tag, Info } from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PromoConfig } from "@/lib/billing/promo";

/**
 * PRÉ-VENDA — PAINEL DO ADMIN (PARTES 17–19)
 * ===========================================
 * Edita a configuração que o SERVIDOR usa para decidir o preço. Três regras de
 * honestidade visíveis nesta tela:
 *
 *  1. A PRÉVIA usa as mesmas funções puras do checkout (`planPromoDisplay`), e
 *     vem recalculada DO SERVIDOR a cada gravação. Não há estimativa local.
 *  2. Um preço promocional que NÃO seja desconto é normalizado pelo servidor e
 *     o admin vê o que passou a valer — em vez de achar que gravou outra coisa.
 *  3. O countdown é um PRAZO REAL. Vencido, ele desliga a promoção, e a prévia
 *     mostra isso antes de o cliente ver.
 */

interface PreviewRow {
  slug: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  discountCents: number;
  discountPercent: number;
  label: string | null;
  showPromo: boolean;
}

interface Countdown {
  running: boolean;
  text: string | null;
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
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

const PLAN_LABEL: Record<string, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
};

/** Campo de dinheiro com rótulo e ajuda. */
function MoneyField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[12.5px] font-semibold text-ink-soft">{label}</span>
      <div className="flex items-center gap-2 rounded-[10px] border border-border-soft bg-card px-3 py-2 focus-within:border-purple/40">
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

export function AdminPromoClient({
  initialConfig,
  initialPreview,
  initialCountdown,
  defaultConfig,
}: {
  initialConfig: PromoConfig;
  initialPreview: PreviewRow[];
  initialCountdown: Countdown;
  defaultConfig: PromoConfig;
}) {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<PromoConfig>(initialConfig);
  const [preview, setPreview] = React.useState<PreviewRow[]>(initialPreview);
  const [countdown, setCountdown] = React.useState<Countdown>(initialCountdown);
  const [busy, setBusy] = React.useState(false);

  const set = (patch: Partial<PromoConfig>) => setConfig((c) => ({ ...c, ...patch }));

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
        preview?: PreviewRow[];
        countdown?: Countdown;
      };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar.", "error");
        return;
      }
      // O servidor devolve o que REALMENTE ficou gravado. Adotamos isso como
      // estado — se ele normalizou algo, o admin vê na hora.
      if (data.config) setConfig(data.config);
      if (data.preview) setPreview(data.preview);
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

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso de prazo vencido — a promoção está DESLIGADA agora. */}
      {countdownExpired && (
        <div className="rounded-md bg-warn-soft border border-warn/20 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-none mt-0.5 text-warn" />
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            O countdown está ativo mas a data já passou.{" "}
            <b className="text-ink">
              O preço promocional não está sendo aplicado
            </b>{" "}
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

      {/* ---------------- SEMANAL ---------------- */}
      <SectionCard
        title="Semanal"
        description="Pagamento único. A condição vale apenas na primeira compra."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={config.semanal.enabled}
            onChange={(v) => set({ semanal: { ...config.semanal, enabled: v } })}
            label="Aplicar pré-venda no semanal"
            disabled={!config.enabled}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Preço promocional"
              hint={`Padrão ${brl(defaultConfig.semanal.promoPriceCents)} · cheio ${brl(2700)}`}
              value={centsToInput(config.semanal.promoPriceCents)}
              disabled={!config.enabled || !config.semanal.enabled}
              onChange={(v) => {
                const cents = parseMoneyToCents(v);
                if (cents != null) set({ semanal: { ...config.semanal, promoPriceCents: cents } });
              }}
            />
            <div className="flex items-end pb-1">
              <Toggle
                checked={config.semanal.requiresNoPreviousPurchase}
                onChange={(v) =>
                  set({ semanal: { ...config.semanal, requiresNoPreviousPurchase: v } })
                }
                label="Somente na primeira compra"
                disabled={!config.enabled || !config.semanal.enabled}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ---------------- MENSAL ---------------- */}
      <SectionCard
        title="Mensal"
        description="Assinatura recorrente. O desconto vale nas primeiras cobranças."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={config.mensal.enabled}
            onChange={(v) => set({ mensal: { ...config.mensal, enabled: v } })}
            label="Aplicar pré-venda no mensal"
            disabled={!config.enabled}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Preço promocional"
              hint={`Padrão ${brl(defaultConfig.mensal.promoPriceCents)} · cheio ${brl(7700)}`}
              value={centsToInput(config.mensal.promoPriceCents)}
              disabled={!config.enabled || !config.mensal.enabled}
              onChange={(v) => {
                const cents = parseMoneyToCents(v);
                if (cents != null) set({ mensal: { ...config.mensal, promoPriceCents: cents } });
              }}
            />
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                Cobranças com desconto
              </span>
              <input
                type="number"
                min={1}
                max={24}
                value={config.mensal.chargesAtPromoPrice}
                disabled={!config.enabled || !config.mensal.enabled}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n > 0) {
                    set({ mensal: { ...config.mensal, chargesAtPromoPrice: n } });
                  }
                }}
                className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] font-data text-ink outline-none focus:border-purple/40 disabled:text-ink-muted"
              />
              <span className="text-[11.5px] text-ink-muted leading-relaxed">
                Padrão {defaultConfig.mensal.chargesAtPromoPrice}. Da{" "}
                {defaultConfig.mensal.chargesAtPromoPrice + 1}ª em diante vale o preço cheio.
              </span>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* ---------------- ANUAL ---------------- */}
      <SectionCard
        title="Anual"
        description="Assinatura recorrente. O desconto vale no primeiro ano."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={config.anual.enabled}
            onChange={(v) => set({ anual: { ...config.anual, enabled: v } })}
            label="Aplicar pré-venda no anual"
            disabled={!config.enabled}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Preço promocional"
              hint={`Padrão ${brl(defaultConfig.anual.promoPriceCents)} · cheio ${brl(54700)}`}
              value={centsToInput(config.anual.promoPriceCents)}
              disabled={!config.enabled || !config.anual.enabled}
              onChange={(v) => {
                const cents = parseMoneyToCents(v);
                if (cents != null) set({ anual: { ...config.anual, promoPriceCents: cents } });
              }}
            />
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                Anos com desconto
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={config.anual.yearsAtPromoPrice}
                disabled={!config.enabled || !config.anual.enabled}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n > 0) {
                    set({ anual: { ...config.anual, yearsAtPromoPrice: n } });
                  }
                }}
                className="rounded-[10px] border border-border-soft bg-card px-3 py-2 text-[13.5px] font-data text-ink outline-none focus:border-purple/40 disabled:text-ink-muted"
              />
              <span className="text-[11.5px] text-ink-muted leading-relaxed">
                Padrão {defaultConfig.anual.yearsAtPromoPrice}. A renovação usa o preço cheio.
              </span>
            </label>
          </div>
        </div>
      </SectionCard>

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

      {/* ---------------- PRÉVIA (vem do SERVIDOR) ---------------- */}
      <SectionCard
        title="Prévia dos cards"
        description="Calculada pelo servidor com as mesmas regras que o checkout usa para cobrar."
        className="p-5"
      >
        <div className="flex flex-col gap-3">
          {preview.map((p) => (
            <div
              key={p.slug}
              className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
            >
              <span className="text-[13px] font-semibold text-ink min-w-[74px]">
                {PLAN_LABEL[p.slug] ?? p.slug}
              </span>
              <span className="text-[13px] font-data text-ink-muted line-through">
                {brl(p.basePriceCents)}
              </span>
              {p.showPromo && p.promoPriceCents != null ? (
                <>
                  <span className="text-[15px] font-data font-bold text-ink">
                    {brl(p.promoPriceCents)}
                  </span>
                  <Badge tone="brand" size="xs">
                    <Tag size={10} />
                    −{p.discountPercent}%
                  </Badge>
                  <span className="text-[12px] text-ink-soft">{p.label}</span>
                </>
              ) : (
                <span className="text-[12.5px] text-ink-muted">
                  Sem promoção — o card mostra apenas {brl(p.basePriceCents)}.
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-surface/40 border border-border-soft px-4 py-3">
          <Info size={15} className="flex-none mt-0.5 text-ink-muted" />
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Esta prévia não considera o histórico de cada comprador. Um preço
            promocional maior ou igual ao cheio é descartado pelo servidor e vale
            o valor cheio — por isso a prévia acima pode mostrar &quot;sem
            promoção&quot; mesmo com o campo preenchido.
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
        <span className={cn("text-[12px] text-ink-muted")}>
          As alterações valem para os próximos checkouts.
        </span>
      </div>
    </div>
  );
}
