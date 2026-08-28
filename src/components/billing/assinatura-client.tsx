"use client";

import * as React from "react";
import {
  CreditCard,
  Check,
  Loader2,
  Sparkles,
  CalendarDays,
  RefreshCcw,
  Ban,
  Zap,
  Crown,
  Wallet,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * MINHA ASSINATURA — Fase 6.5 (6.5.15 a 6.5.20, 6.5.24 a 6.5.26)
 * ==============================================================
 * Página funcional de planos e assinatura.
 *
 * - Cards dos 3 planos oficiais (Semanal/Mensal/Anual), sem plano Combo.
 * - "Escolher plano" → checkout CONTROLADO: "Pagamento online em configuração."
 *   (NENHUMA URL fake, NENHUM gateway real nesta fase).
 * - "Minha Assinatura": plano, preço, status, cobrança, início, expiração,
 *   próxima renovação, renovação automática, dias restantes.
 * - Cancelar renovação futura (owner-check, sem cancelamento externo falso).
 * - Responsivo (desktop/notebook/tablet/mobile).
 */

interface PlanView {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  type: string;
  billingInterval: string | null;
  durationDays: number | null;
  description: string | null;
  features: string[];
  badge: string | null;
  active: boolean;
  sortOrder: number;
}

interface SubscriptionView {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  priceCents: number;
  currency: string;
  status: string;
  billingType: string;
  billingInterval: string | null;
  autoRenew: boolean;
  startAt: string | null;
  expiresAt: string | null;
  nextBillingAt: string | null;
  canceledAt: string | null;
  active: boolean;
  daysRemaining: number;
  provider: string | null;
  createdAt: string;
}

interface AccessStatus {
  hasSubscription: boolean;
  active: boolean;
  status: string | null;
  expiresAt: string | null;
  daysRemaining: number;
  planName: string | null;
}

interface AssinaturaClientProps {
  initialPlans: PlanView[];
  initialCurrent: SubscriptionView | null;
  initialHistory: SubscriptionView[];
  initialAccess: AccessStatus;
}

const BADGE_LABEL: Record<string, string> = {
  MAIS_ESCOLHIDO: "Mais escolhido",
  MELHOR_CUSTO_BENEFICIO: "Melhor custo-benefício",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELED: "Cancelada",
  PAST_DUE: "Pagamento atrasado",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  PENDING: "warning",
  ACTIVE: "success",
  EXPIRED: "neutral",
  CANCELED: "neutral",
  PAST_DUE: "danger",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AssinaturaClient({
  initialPlans,
  initialCurrent,
  initialHistory,
  initialAccess,
}: AssinaturaClientProps) {
  const { toast } = useToast();

  const [plans, setPlans] = React.useState<PlanView[]>(initialPlans);
  const [current, setCurrent] = React.useState<SubscriptionView | null>(initialCurrent);
  const [history, setHistory] = React.useState<SubscriptionView[]>(initialHistory);
  const [access, setAccess] = React.useState<AccessStatus>(initialAccess);
  const [checkingPlan, setCheckingPlan] = React.useState<string | null>(null);
  const [canceling, setCanceling] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function choosePlan(plan: PlanView) {
    setCheckingPlan(plan.id);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok && data.status !== "INTEGRATION_NOT_CONFIGURED") {
        toast(data.error ?? "Erro ao iniciar o checkout.", "error");
        return;
      }
      // Estado controlado esperado nesta fase — pagamento online em configuração.
      setNotice(
        `${plan.name} — ${formatBRL(plan.priceCents)}. Pagamento online em configuração.`
      );
      toast("Pagamento online em configuração.");
    } catch {
      toast("Não foi possível iniciar o checkout.", "error");
    } finally {
      setCheckingPlan(null);
    }
  }

  async function cancelRenewal() {
    if (!current) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: current.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erro ao cancelar renovação.", "error");
        return;
      }
      setCurrent((prev) => (prev ? { ...prev, autoRenew: false, canceledAt: new Date().toISOString() } : prev));
      toast("Renovação automática desativada. Acesso mantido até o fim do período.");
    } catch {
      toast("Não foi possível cancelar a renovação.", "error");
    } finally {
      setCanceling(false);
    }
  }

  // Destaque visual (nunca destaca plano Combo — ele não existe).
  const featured = plans.find((p) => p.badge === "MAIS_ESCOLHIDO") ?? plans[1] ?? null;
  const bestValue = plans.find((p) => p.badge === "MELHOR_CUSTO_BENEFICIO") ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Cards de planos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple" />
          <h2 className="font-display text-[17px] font-semibold text-ink">Planos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isFeatured = plan.badge === "MAIS_ESCOLHIDO";
            const isBest = plan.badge === "MELHOR_CUSTO_BENEFICIO";
            const isCurrent = current?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-lg bg-card border shadow-xs p-6 flex flex-col gap-4 relative",
                  isFeatured
                    ? "border-purple/50 ring-1 ring-purple/30"
                    : isBest
                    ? "border-border"
                    : "border-border-soft"
                )}
              >
                {isFeatured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-pill bg-brand-grad text-white text-[11px] font-bold uppercase tracking-wider shadow-brand">
                    <Badge tone="brand" className="!bg-transparent !border-0 !text-white">
                      <Crown size={11} /> Mais escolhido
                    </Badge>
                  </span>
                )}
                {isBest && !isFeatured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-pill bg-purple text-white text-[11px] font-bold uppercase tracking-wider shadow-brand">
                    Melhor custo-benefício
                  </span>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[16px] font-semibold text-ink">{plan.name}</h3>
                    {isCurrent && <Badge tone="success" size="xs">Atual</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-[30px] font-bold text-ink">
                      {formatBRL(plan.priceCents)}
                    </span>
                    <span className="text-[12.5px] text-ink-soft">
                      {plan.billingInterval === "MONTH" && "/mês"}
                      {plan.billingInterval === "YEAR" && "/ano"}
                      {plan.type === "ONE_TIME" && "/semana"}
                    </span>
                  </div>
                  {plan.slug === "anual" && (
                    <p className="text-[11.5px] text-ink-soft">
                      ≈ {formatBRL(49700 / 12)}/mês · 12× {formatBRL(7700 * 12)} · economia{" "}
                      {formatBRL(7700 * 12 - 49700)}
                    </p>
                  )}
                  {plan.description && (
                    <p className="text-[12.5px] text-ink-soft leading-snug mt-0.5">{plan.description}</p>
                  )}
                </div>

                <ul className="flex flex-col gap-1.5 flex-1">
                  {plan.features.slice(0, 8).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink">
                      <Check size={14} className="text-success flex-none mt-0.5" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-[12.5px] text-ink-muted italic">
                    <Info size={14} className="flex-none mt-0.5" />
                    Automações e publicação automática: disponíveis quando a integração for liberada.
                  </li>
                </ul>

                <Button
                  variant={isFeatured ? "primary" : "outline"}
                  size="sm"
                  block
                  disabled={checkingPlan !== null || isCurrent}
                  onClick={() => choosePlan(plan)}
                  className={cn(!isFeatured && isBest && "border-purple/40 text-purple hover:bg-ai-soft")}
                >
                  {checkingPlan === plan.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Wallet size={15} />
                  )}
                  {isCurrent ? "Plano atual" : "Escolher plano"}
                </Button>
              </div>
            );
          })}
        </div>
        {notice && (
          <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn flex items-center gap-2">
            <Info size={15} className="flex-none" />
            {notice}
          </div>
        )}
      </section>

      {/* Minha assinatura */}
      <section className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-purple" />
          <h2 className="font-display text-[17px] font-semibold text-ink">Minha assinatura</h2>
        </div>

        {!current ? (
          <EmptyState
            icon={CreditCard}
            title="Você ainda não tem uma assinatura"
            description="Escolha um dos planos acima para começar. Nesta fase o pagamento está em configuração."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <InfoCell label="Plano" value={current.planName} />
              <InfoCell label="Preço" value={formatBRL(current.priceCents)} />
              <InfoCell
                label="Status"
                value={
                  <Badge tone={STATUS_TONE[current.status] ?? "neutral"} dot>
                    {STATUS_LABEL[current.status] ?? current.status}
                  </Badge>
                }
              />
              <InfoCell
                label="Cobrança"
                value={
                  current.billingType === "RECURRING"
                    ? current.billingInterval === "MONTH"
                      ? "Mensal (recorrente)"
                      : current.billingInterval === "YEAR"
                      ? "Anual (recorrente)"
                      : "Recorrente"
                    : "Pagamento único"
                }
              />
              <InfoCell label="Início" value={formatFullDate(current.startAt)} />
              <InfoCell label="Expiração" value={formatFullDate(current.expiresAt)} />
              <InfoCell
                label="Próxima renovação"
                value={
                  current.autoRenew
                    ? formatFullDate(current.nextBillingAt ?? current.expiresAt)
                    : "—"
                }
              />
              <InfoCell
                label="Renovação automática"
                value={
                  <span className={cn("font-semibold", current.autoRenew ? "text-success" : "text-ink-muted")}>
                    {current.autoRenew ? "Ativa" : "Desativada"}
                  </span>
                }
              />
            </div>

            {current.daysRemaining > 0 && (
              <div className="rounded-[10px] bg-surface px-4 py-3 flex items-center gap-2 text-[13px] text-ink">
                <CalendarDays size={15} className="text-purple flex-none" />
                {current.active ? "Acesso ativo" : "Acesso"} · {current.daysRemaining} dia
                {current.daysRemaining === 1 ? "" : "s"} restante{current.daysRemaining === 1 ? "" : "s"}.
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {current.autoRenew && current.billingType === "RECURRING" ? (
                <Button variant="ghost" size="sm" onClick={cancelRenewal} disabled={canceling} className="gap-1.5 text-danger">
                  {canceling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                  Cancelar renovação futura
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted px-1">
                  <RefreshCcw size={13} />
                  {current.billingType === "RECURRING"
                    ? "Renovação futura já desativada."
                    : "Plano de pagamento único — sem renovação automática."}
                </span>
              )}
              <Button variant="outline" size="sm" className="gap-1.5">
                <Zap size={14} /> Ver planos / trocar plano
              </Button>
            </div>

            <p className="text-[11.5px] text-ink-muted">
              Pagamento e cobrança online chegam com a integração Asaas (fase futura).
              Esta página reflete apenas o estado interno — nada é cobrado.
            </p>
          </div>
        )}
      </section>

      {/* Histórico */}
      {history.length > 0 && (
        <section className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <RefreshCcw size={16} className="text-purple" />
            <h2 className="font-display text-[17px] font-semibold text-ink">Histórico de assinaturas</h2>
          </div>
          <div className="flex flex-col gap-2">
            {history.map((s) => (
              <div
                key={s.id}
                className="rounded-[10px] border border-border-soft bg-bg-ice px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <span className="text-[13px] font-semibold text-ink">{s.planName}</span>
                <span className="text-[12.5px] text-ink-soft">{formatBRL(s.priceCents)}</span>
                <Badge tone={STATUS_TONE[s.status] ?? "neutral"} size="xs">
                  {STATUS_LABEL[s.status] ?? s.status}
                </Badge>
                <span className="text-[12px] text-ink-muted ml-auto">
                  Início {formatDate(s.startAt)} · Expira {formatDate(s.expiresAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border-soft bg-bg-ice px-3.5 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
      <div className="text-[13px] text-ink font-medium">{value}</div>
    </div>
  );
}
