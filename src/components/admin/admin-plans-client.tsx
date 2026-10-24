"use client";

import * as React from "react";
import {
  Loader2,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  ShieldAlert,
  Power,
} from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PlanQuota } from "@/lib/billing/plans/limits";

/**
 * PLANOS — PAINEL DO ADMIN
 * ========================
 * Duas ações comerciais, ambas server-side:
 *   1. LIGA/DESLIGA a venda de um plano (override + `Plan.active`).
 *   2. AJUSTA a franquia de um plano (override gravado em `SystemSetting`).
 *
 * Regras de honestidade visíveis:
 *  - A prévia de preço e a franquia EFETIVA vêm do servidor, não de estimativa.
 *  - Desativar um plano avisa que NÃO cancela assinaturas vigentes.
 *  - Franquia ajustada avisa que NÃO muda contrato ativo retroativamente.
 *  - Todo ajuste deixa registro na auditoria (quem/quando/o quê).
 */

export interface AdminPlanQuotas {
  effective: PlanQuota;
  default: PlanQuota | null;
  overridden: string[];
}

export interface AdminPlanRow {
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  type: string;
  billingInterval: string | null;
  durationDays: number | null;
  sortOrder: number;
  legacy: boolean;
  catalogActive: boolean;
  active: boolean;
  quotas: AdminPlanQuotas;
}

export interface QuotaFieldDef {
  field: keyof PlanQuota;
  label: string;
}

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  slug: string | null;
  summary: string;
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function typeLabel(p: AdminPlanRow): string {
  if (p.type !== "RECURRING") {
    return p.durationDays ? `Compra única · ${p.durationDays} dias` : "Compra única";
  }
  if (p.billingInterval === "MONTH") return "Recorrente · mensal";
  if (billingIntervalLabel(p.billingInterval)) return `Recorrente · ${billingIntervalLabel(p.billingInterval)}`;
  return "Recorrente";
}

function billingIntervalLabel(interval: string | null): string | null {
  if (interval === "YEAR") return "anual";
  return null;
}

/** Valor de franquia → texto do input ("" = sem teto). */
function quotaToInput(v: number | null): string {
  return v == null ? "" : String(v);
}

/** Texto do input → valor validado. `undefined` = inválido (não altera). */
function parseQuotaInput(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null; // sem teto (explícito)
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  if (!Number.isSafeInteger(n)) return undefined;
  return n;
}

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

export function AdminPlansClient({
  initialPlans,
  quotaFields,
  limitsEnforcementEnabled,
  initialAudit,
}: {
  initialPlans: AdminPlanRow[];
  quotaFields: QuotaFieldDef[];
  limitsEnforcementEnabled: boolean;
  initialAudit: AuditRow[];
}) {
  const { toast } = useToast();

  const [plans, setPlans] = React.useState<AdminPlanRow[]>(initialPlans);
  const [audit, setAudit] = React.useState<AuditRow[]>(initialAudit);
  const [busySlug, setBusySlug] = React.useState<string | null>(null);
  const [busySave, setBusySave] = React.useState(false);

  // Franquias em edição — cópia local por slug. Só as chaves mexidas entram no
  // payload; o resto continua valendo o padrão do código.
  const [draft, setDraft] = React.useState<Record<string, Partial<Record<keyof PlanQuota, number | null>>>>(
    () => {
      const out: Record<string, Partial<Record<keyof PlanQuota, number | null>>> = {};
      for (const p of initialPlans) {
        out[p.slug] = { ...p.quotas.effective };
      }
      return out;
    }
  );

  const reload = async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const data = (await res.json()) as {
        plans?: AdminPlanRow[];
        audit?: AuditRow[];
      };
      if (data.plans) {
        setPlans(data.plans);
        const next: Record<string, Partial<Record<keyof PlanQuota, number | null>>> = {};
        for (const p of data.plans) next[p.slug] = { ...p.quotas.effective };
        setDraft(next);
      }
      if (data.audit) setAudit(data.audit);
    } catch {
      /* silencioso: o dado anterior segue na tela */
    }
  };

  const toggleActive = async (slug: string, active: boolean) => {
    setBusySlug(slug);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-active", slug, active }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível alterar a ativação.", "error");
        return;
      }
      setPlans((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, active } : p))
      );
      toast(
        active ? "Plano ativado para venda." : "Plano desativado para novas vendas.",
        "success"
      );
      await reload();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusySlug(null);
    }
  };

  const setQuota = (slug: string, field: keyof PlanQuota, raw: string) => {
    const parsed = parseQuotaInput(raw);
    if (parsed === undefined) return; // entrada inválida: não altera
    setDraft((d) => ({ ...d, [slug]: { ...d[slug], [field]: parsed } }));
  };

  /** Monta o payload só com os campos DIFERENTES do padrão do código. */
  const buildOverrides = () => {
    const out: Record<string, Partial<Record<keyof PlanQuota, number | null>>> = {};
    for (const p of plans) {
      const eff = draft[p.slug] ?? {};
      const base = p.quotas.default ?? {};
      const entry: Partial<Record<keyof PlanQuota, number | null>> = {};
      for (const f of quotaFields) {
        const val = eff[f.field];
        const def = (base as Record<string, number | null>)[f.field] ?? null;
        if (val !== undefined && val !== def) entry[f.field] = val;
      }
      if (Object.keys(entry).length > 0) out[p.slug] = entry;
    }
    return out;
  };

  const saveLimits = async () => {
    setBusySave(true);
    try {
      const overrides = buildOverrides();
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-limits", overrides }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast(data.error ?? "Não foi possível salvar as franquias.", "error");
        return;
      }
      toast("Franquias salvas.", "success");
      await reload();
    } catch {
      toast("Erro de conexão.", "error");
    } finally {
      setBusySave(false);
    }
  };

  const restoreDefaults = () => {
    const next: Record<string, Partial<Record<keyof PlanQuota, number | null>>> = {};
    for (const p of plans) {
      const base = p.quotas.default;
      next[p.slug] = base ? { ...base } : { ...p.quotas.effective };
    }
    setDraft(next);
    toast("Franquias restauradas ao padrão em código. Clique em Salvar.", "info");
  };

  const sellable = plans.filter((p) => !p.legacy);
  const legacy = plans.filter((p) => p.legacy);

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso central: contratos vigentes x mudanças comerciais. */}
      <div className="rounded-md bg-warn-soft border border-warn/20 px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert size={16} className="flex-none mt-0.5 text-warn" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          <b className="text-ink">Desativar um plano NÃO cancela assinaturas vigentes</b>{" "}
          nem interrompe quem já paga — ele apenas deixa de ser oferecido no
          checkout. Ajustar franquias também{" "}
          <b className="text-ink">não altera retroativamente um contrato ativo</b>{" "}
          sem uma regra explícita (que não é aplicada aqui).
        </p>
      </div>

      {/* Modo de enforcement das franquias. */}
      <div
        className={cn(
          "rounded-md border px-4 py-3 flex items-start gap-2.5",
          limitsEnforcementEnabled
            ? "bg-danger-softMid border-danger/20"
            : "bg-surface/50 border-border-soft"
        )}
      >
        {limitsEnforcementEnabled ? (
          <AlertTriangle size={16} className="flex-none mt-0.5 text-danger" />
        ) : (
          <Info size={16} className="flex-none mt-0.5 text-ink-muted" />
        )}
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          {limitsEnforcementEnabled ? (
            <>
              <b className="text-ink">Franquias em MODO BLOQUEIO.</b> Consumo acima
              do limite é recusado. Confirme que os números abaixo estão corretos.
            </>
          ) : (
            <>
              Franquias em <b className="text-ink">modo medição</b>: o consumo é
              registrado, mas nada é bloqueado. Ligar o bloqueio é uma decisão
              comercial (constante em código) e não é feita por esta tela.
            </>
          )}
        </p>
      </div>

      {/* ---------------- PLANOS VENDÁVEIS ---------------- */}
      <SectionCard
        title="Planos à venda"
        description="Liga/desliga a venda e ajusta a franquia. Preços em centavos — só exibição."
        className="p-5"
      >
        <div className="flex flex-col gap-4">
          {sellable.map((p) => {
            const busy = busySlug === p.slug;
            const eff = draft[p.slug] ?? {};
            return (
              <div
                key={p.slug}
                className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-4 flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-[160px]">
                    <p className="text-[14px] font-semibold text-ink">{p.name}</p>
                    <p className="text-[11.5px] text-ink-muted font-data">
                      {p.slug} · ordem {p.sortOrder}
                    </p>
                  </div>
                  <span className="text-[15px] font-data font-bold text-ink">
                    {brl(p.priceCents)}
                  </span>
                  <span className="text-[11.5px] text-ink-muted font-data">
                    {p.priceCents}¢
                  </span>
                  <Badge tone="neutral" size="xs">
                    {typeLabel(p)}
                  </Badge>
                  {p.active ? (
                    <Badge tone="success" size="xs" dot>
                      À venda
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="xs" dot>
                      Fora de venda
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {busy ? (
                      <Loader2 size={15} className="animate-spin text-ink-muted" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleActive(p.slug, !p.active)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer",
                          p.active
                            ? "border-danger/20 bg-danger-softMid text-danger hover:bg-danger/10"
                            : "border-success/30 bg-success-soft text-success hover:bg-success/10"
                        )}
                        title={
                          p.active
                            ? "Deixar de vender este plano (não cancela assinaturas)"
                            : "Voltar a vender este plano"
                        }
                      >
                        <Power size={12} />
                        {p.active ? "Desativar venda" : "Ativar venda"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Franquias */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {quotaFields.map((f) => {
                    const val = eff[f.field];
                    const def = (p.quotas.default as Record<string, number | null> | null)?.[
                      f.field
                    ];
                    const overridden = p.quotas.overridden.includes(f.field as string);
                    return (
                      <label key={f.field} className="flex flex-col gap-1 min-w-0">
                        <span className="text-[11px] font-semibold text-ink-soft truncate" title={f.label}>
                          {f.label}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="sem teto"
                          value={quotaToInput(val ?? null)}
                          onChange={(e) => setQuota(p.slug, f.field, e.target.value)}
                          className={cn(
                            "rounded-[9px] border bg-card px-2.5 py-1.5 text-[13px] font-data text-ink outline-none focus:border-purple/40",
                            overridden ? "border-purple/40" : "border-border-soft"
                          )}
                        />
                        <span className="text-[10.5px] text-ink-muted">
                          padrão {def == null ? "∞" : def}
                          {overridden ? " · ajustado" : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-5 pt-4 border-t border-border-soft">
          <Button variant="primary" size="sm" onClick={saveLimits} disabled={busySave}>
            {busySave ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {busySave ? "Salvando…" : "Salvar franquias"}
          </Button>
          <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={busySave}>
            <RotateCcw size={14} />
            Restaurar padrão (código)
          </Button>
          <span className="text-[12px] text-ink-muted">
            Deixe vazio para &quot;sem teto&quot;. O padrão em código continua sendo a
            fonte de verdade até você sobrescrever.
          </span>
        </div>
      </SectionCard>

      {/* ---------------- PLANOS LEGADOS ---------------- */}
      {legacy.length > 0 && (
        <SectionCard
          title="Planos legados"
          description="Mantidos para assinaturas e pedidos históricos. Remover quebraria contratos."
          className="p-5"
        >
          <div className="flex flex-col gap-4">
            {legacy.map((p) => {
              const busy = busySlug === p.slug;
              const eff = draft[p.slug] ?? {};
              return (
                <div
                  key={p.slug}
                  className="rounded-[12px] border border-border-soft bg-surface/40 px-4 py-4 flex flex-col gap-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-[160px]">
                      <p className="text-[14px] font-semibold text-ink">{p.name}</p>
                      <p className="text-[11.5px] text-ink-muted font-data">
                        {p.slug} · ordem {p.sortOrder}
                      </p>
                    </div>
                    <span className="text-[15px] font-data font-bold text-ink">
                      {brl(p.priceCents)}
                    </span>
                    <span className="text-[11.5px] text-ink-muted font-data">
                      {p.priceCents}¢
                    </span>
                    <Badge tone="warning" size="xs">
                      Legado
                    </Badge>
                    <Badge tone="neutral" size="xs">
                      {typeLabel(p)}
                    </Badge>
                    {p.active ? (
                      <Badge tone="success" size="xs" dot>
                        À venda
                      </Badge>
                    ) : (
                      <Badge tone="neutral" size="xs" dot>
                        Fora de venda
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                      {busy ? (
                        <Loader2 size={15} className="animate-spin text-ink-muted" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleActive(p.slug, !p.active)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer",
                            p.active
                              ? "border-danger/20 bg-danger-softMid text-danger hover:bg-danger/10"
                              : "border-success/30 bg-success-soft text-success hover:bg-success/10"
                          )}
                        >
                          <Power size={12} />
                          {p.active ? "Desativar venda" : "Ativar venda"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {quotaFields.map((f) => {
                      const val = eff[f.field];
                      const def = (p.quotas.default as Record<string, number | null> | null)?.[
                        f.field
                      ];
                      const overridden = p.quotas.overridden.includes(f.field as string);
                      return (
                        <label key={f.field} className="flex flex-col gap-1 min-w-0">
                          <span className="text-[11px] font-semibold text-ink-soft truncate" title={f.label}>
                            {f.label}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="sem teto"
                            value={quotaToInput(val ?? null)}
                            onChange={(e) => setQuota(p.slug, f.field, e.target.value)}
                            className={cn(
                              "rounded-[9px] border bg-card px-2.5 py-1.5 text-[13px] font-data text-ink outline-none focus:border-purple/40",
                              overridden ? "border-purple/40" : "border-border-soft"
                            )}
                          />
                          <span className="text-[10.5px] text-ink-muted">
                            padrão {def == null ? "∞" : def}
                            {overridden ? " · ajustado" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ---------------- AUDITORIA ---------------- */}
      <SectionCard
        title="Histórico de mudanças"
        description="Registro append-only das alterações comerciais (quem, quando, o quê)."
        action={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
            <History size={14} /> {audit.length} registro(s)
          </span>
        }
        className="p-5"
      >
        {audit.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            Nenhuma alteração registrada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
            {audit.map((e) => (
              <div
                key={e.id}
                className="rounded-[10px] border border-border-soft bg-surface/40 px-3.5 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <span className="text-[11.5px] text-ink-muted font-data flex-none">
                  {fmtDateTime(e.at)}
                </span>
                <Badge
                  tone={e.action === "plan.active" ? "brand" : "info"}
                  size="xs"
                >
                  {e.action === "plan.active"
                    ? "Ativação"
                    : e.action === "plan.limits"
                      ? "Franquias"
                      : "Promoção"}
                </Badge>
                <span className="text-[12.5px] text-ink flex-1 min-w-[200px]">
                  {e.summary}
                </span>
                <span className="text-[11.5px] text-ink-muted break-all">{e.actor}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <CheckCircle2 size={14} className="text-success" />
        Alterações valem para os próximos checkouts.
      </div>
    </div>
  );
}
