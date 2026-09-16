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
  ExternalLink,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  annualVsMonthly,
  formatBRL,
  LANDING_PLAN_FEATURES,
  planBillingLabel,
  planPriceSuffix,
  planShortName,
} from "@/lib/billing/plans/display";
import { cn } from "@/lib/utils";

/**
 * AVISO DE CHECKOUT — Fase "Primeiro Acesso".
 * O e-mail informado na compra é a identidade inicial do acesso. Este aviso
 * é exibido na página de assinatura para que o cliente use um e-mail ao qual
 * tenha acesso — será com ele que o primeiro acesso será liberado.
 */
const CHECKOUT_EMAIL_WARNING =
  "Use um e-mail que você tenha acesso. Este mesmo e-mail será utilizado para liberar seu acesso ao Inst Acessor.";

/**
 * MINHA ASSINATURA — Asaas (checkout hospedado oficial)
 * ======================================================
 * Página funcional de planos e assinatura com os estados REAIS:
 *
 * Duas áreas na ordem oficial:
 * 1) MINHA ASSINATURA ATUAL — estado real da assinatura do usuário.
 *    Sem assinatura → "Você ainda não tem uma assinatura" (EmptyState).
 * 2) PLANOS DISPONÍVEIS — cards gerados a partir dos planos REAIS vindos do
 *    servidor (`listPlans`/`/api/billing/plans`). Nunca inventa preço no
 *    frontend. Cada CTA cria um checkout Asaas no servidor
 *    (`POST /api/billing/checkout` → checkout hospedado `POST /v3/checkouts`,
 *    em nova aba). Preço/duração/ciclo são SEMPRE resolvidos no backend pelo
 *    catálogo — o navegador nunca envia valor.
 *
 * Estados reais:
 * - Aguardando pagamento (PENDING) → cobrança criada no gateway, aguardando
 *   confirmação. NUNCA mostra "pagamento aprovado" sem confirmação real.
 * - Ativa (ACTIVE) → acesso liberado (confirmação do pagamento processada).
 * - Vencida/Expirada (EXPIRED), Cancelada (CANCELED), Pagamento atrasado
 *   (PAST_DUE) — cada uma com mensagem própria.
 *
 * O InfinitePay foi REMOVIDO dos fluxos ativos (histórico preservado).
 * NENHUMA aprovação de pagamento é simulada.
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
  paidAt: string | null;
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
  /** Integração Asaas configurada no servidor (sem revelar chave). */
  billingConfigured?: boolean;
  /** Rótulo do ambiente ("Sandbox"/"Produção") quando configurado. */
  billingLabel?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
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

/** Mensagem amigável por estado real da assinatura (nunca inventa confirmação). */
function statusMessage(
  s: SubscriptionView | null,
  billingConfigured: boolean
): string | null {
  if (!s) return null;
  switch (s.status) {
    case "PENDING":
      return billingConfigured
        ? "Pagamento iniciado. Seu acesso é liberado assim que o pagamento for confirmado."
        : "Checkout criado. Nenhuma cobrança foi feita — o pagamento online está em configuração.";
    case "ACTIVE":
      return "Pagamento confirmado. Seu acesso está ativo.";
    case "PAST_DUE":
      return "Cobrança recorrente atrasada. Renove o pagamento para manter o acesso ativo.";
    case "EXPIRED":
      return "Seu período de acesso terminou. Escolha um plano para continuar.";
    case "CANCELED":
      return s.billingType === "RECURRING"
        ? "Renovação futura cancelada. Você mantém o acesso até o fim do período pago."
        : "Assinatura cancelada.";
    default:
      return null;
  }
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

/**
 * Rótulo do tipo de cobrança de uma assinatura. A REGRA vive em
 * `planBillingLabel` (módulo de apresentação dos planos) para não haver uma
 * segunda redação de "Pagamento único"/"Mensal (recorrente)" neste arquivo.
 */
function billingLabelText(s: SubscriptionView): string {
  return planBillingLabel({ type: s.billingType, billingInterval: s.billingInterval });
}

export function AssinaturaClient({
  initialPlans,
  initialCurrent,
  initialHistory,
  initialAccess,
  billingConfigured = false,
  billingLabel = null,
}: AssinaturaClientProps) {
  const { toast } = useToast();

  const [plans, setPlans] = React.useState<PlanView[]>(initialPlans);
  const [current, setCurrent] = React.useState<SubscriptionView | null>(initialCurrent);
  const [history, setHistory] = React.useState<SubscriptionView[]>(initialHistory);
  const [access, setAccess] = React.useState<AccessStatus>(initialAccess);
  const [checkingPlan, setCheckingPlan] = React.useState<string | null>(null);
  const [canceling, setCanceling] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "info" | "warn" | "success"; text: string } | null>(null);
  const [checkoutUrl, setCheckoutUrl] = React.useState<string | null>(null);

  async function choosePlan(plan: PlanView) {
    setCheckingPlan(plan.id);
    setNotice(null);
    setCheckoutUrl(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      // Um erro 500 do servidor devolve a PÁGINA de erro (HTML), não JSON.
      // Ler como texto e só então tentar o parse evita que `res.json()` lance
      // e esconda a causa, deixando o usuário com um aviso genérico.
      const rawBody = await res.text();
      let data: {
        error?: string;
        status?: string;
        checkout?: { checkoutUrl?: string | null; subscriptionId?: string | null };
      } | null = null;
      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        toast(
          data?.error ?? "Não foi possível iniciar o checkout. Tente novamente.",
          "error"
        );
        return;
      }

      // Resposta 200 porém SEM corpo JSON (vazio, ou não-JSON): não dá para
      // saber o estado da compra. Trata como falha em vez de seguir e exibir
      // um checkout que não existe. Depois desta guarda `data` é não-nulo.
      if (!data) {
        toast("Não foi possível iniciar o checkout. Tente novamente.", "error");
        return;
      }

      if (data.status === "INTEGRATION_NOT_CONFIGURED") {
        // Estado controlado — nenhuma cobrança real foi feita.
        setNotice({
          kind: "warn",
          text: `${planShortName(plan)} — ${formatBRL(plan.priceCents)}. Pagamento online em configuração. Nenhuma cobrança foi feita.`,
        });
        toast("Pagamento online em configuração.");
        return;
      }

      // Checkout REAL criado: estado PENDING — o acesso só é liberado após
      // confirmação do pagamento (webhook). NUNCA marca como ativo aqui.
      const url = typeof data?.checkout?.checkoutUrl === "string" ? data.checkout.checkoutUrl : null;
      setCheckoutUrl(url);
      setNotice({
        kind: "info",
        text: `${planShortName(plan)} — ${formatBRL(plan.priceCents)}. Checkout iniciado. Seu acesso é liberado assim que o pagamento for confirmado.`,
      });
      toast(url ? "Checkout criado. Finalize o pagamento." : "Checkout criado. Aguardando pagamento.");

      // Atualiza o estado local para refletir o PENDING (a página recarrega
      // quando o usuário voltar; aqui apenas evita mostrar "sem assinatura").
      setCurrent((prev) => {
        if (prev) return prev;
        return {
          id: data?.checkout?.subscriptionId ?? "",
          planId: plan.id,
          planName: plan.name,
          planSlug: plan.slug,
          priceCents: plan.priceCents,
          currency: plan.currency,
          status: "PENDING",
          billingType: plan.type,
          billingInterval: plan.billingInterval ?? null,
          autoRenew: plan.type === "RECURRING",
          startAt: null,
          expiresAt: null,
          nextBillingAt: null,
          canceledAt: null,
          paidAt: null,
          active: false,
          daysRemaining: 0,
          provider: "asaas",
          createdAt: new Date().toISOString(),
        };
      });
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

  const scrollToPlans = () => {
    const el = document.getElementById("planos-disponiveis");
    if (!el) return;
    // Respeita prefers-reduced-motion: sem animação de scroll suave.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de e-mail do checkout (primeiro acesso) */}
      <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3 flex items-start gap-2.5 text-[13px] text-warn">
        <Mail size={16} className="flex-none mt-0.5" />
        <span>
          <strong className="font-semibold">Importante:</strong>{" "}
          {CHECKOUT_EMAIL_WARNING}
        </span>
      </div>

      {/* ÁREA 1 — MINHA ASSINATURA ATUAL */}
      <section className="rounded-lg bg-card border border-border-soft shadow-xs p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-purple" />
          <h2 className="font-display text-[17px] font-semibold text-ink">Minha assinatura atual</h2>
          {current && (
            <Badge tone={STATUS_TONE[current.status] ?? "neutral"} size="xs" dot>
              {STATUS_LABEL[current.status] ?? current.status}
            </Badge>
          )}
        </div>

        {!current ? (
          <EmptyState
            icon={CreditCard}
            title="Você ainda não tem uma assinatura"
            description="Escolha um dos planos abaixo para começar."
            action={
              <Button variant="primary" size="sm" onClick={scrollToPlans}>
                <Sparkles size={15} /> Ver planos disponíveis
              </Button>
            }
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
              <InfoCell label="Cobrança" value={billingLabelText(current)} />
              <InfoCell label="Início" value={formatFullDate(current.startAt)} />
              <InfoCell label="Expiração" value={formatFullDate(current.expiresAt)} />
              <InfoCell label="Pagamento confirmado em" value={formatFullDate(current.paidAt)} />
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

            {statusMessage(current, billingConfigured) && (
              <div className="rounded-[10px] bg-surface px-4 py-3 flex items-start gap-2 text-[13px] text-ink">
                <Info size={15} className="text-purple flex-none mt-0.5" />
                <span className="min-w-0 break-words">{statusMessage(current, billingConfigured)}</span>
              </div>
            )}

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
              <Button variant="outline" size="sm" className="gap-1.5" onClick={scrollToPlans}>
                <Zap size={14} /> Ver planos / trocar plano
              </Button>
            </div>

            <p className="text-[11.5px] text-ink-muted flex flex-wrap items-center gap-x-1.5">
              <span>
                Pagamento online via Asaas (checkout oficial). A liberação do
                acesso depende da confirmação real do pagamento — nunca é
                simulada.
              </span>
            </p>
          </div>
        )}
      </section>

      {/* ÁREA 2 — PLANOS DISPONÍVEIS */}
      <section id="planos-disponiveis" className="flex flex-col gap-3 scroll-mt-24">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple" />
          <h2 className="font-display text-[17px] font-semibold text-ink">Planos disponíveis</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isFeatured = plan.badge === "MAIS_ESCOLHIDO";
            const isBest = plan.badge === "MELHOR_CUSTO_BENEFICIO";
            const isCurrent = current?.planId === plan.id;
            // Comparativo do anual contra 12 meses do mensal, calculado a
            // partir dos PREÇOS REAIS desta lista — nada de constantes
            // numéricas escritas aqui (antes eram 54700/7700 literais).
            const annualCompare =
              plan.type === "RECURRING" && plan.billingInterval === "YEAR"
                ? annualVsMonthly(plans)
                : null;
            const priceSuffix = planPriceSuffix(plan);
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
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-pill bg-brand-grad text-white text-[11px] font-bold uppercase tracking-wider shadow-brand max-sm:static max-sm:top-auto max-sm:left-auto max-sm:translate-x-0 max-sm:self-center max-sm:w-fit">
                    <Badge tone="brand" className="!bg-transparent !border-0 !text-white">
                      <Crown size={11} /> Mais escolhido
                    </Badge>
                  </span>
                )}
                {isBest && !isFeatured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-pill bg-purple text-white text-[11px] font-bold uppercase tracking-wider shadow-brand max-sm:static max-sm:top-auto max-sm:left-auto max-sm:translate-x-0 max-sm:self-center max-sm:w-fit">
                    Melhor custo-benefício
                  </span>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h3 className="font-display text-[16px] font-semibold text-ink min-w-0 break-words">
                      {planShortName(plan)}
                    </h3>
                    {isCurrent && (
                      <Badge tone="success" size="xs">
                        Atual
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0">
                    {/* BLOCO 5 — o preço é atômico.
                        Sem `whitespace-nowrap` o valor formatado ("R$ 547,00")
                        podia quebrar no espaço entre o símbolo e o número,
                        produzindo "R$" numa linha e "547,00" na seguinte em
                        cards estreitos. `flex-wrap` continua no container para
                        o sufixo ("/mês") descer quando faltar espaço, mas o
                        NÚMERO nunca se divide. */}
                    <span className="font-display text-[30px] font-bold text-ink whitespace-nowrap">
                      {formatBRL(plan.priceCents)}
                    </span>
                    {/* "único" para o plano de pagamento único — mesma regra
                        do checkout, sem repetir a cadeia de ifs aqui. */}
                    <span className="text-[12.5px] text-ink-soft">
                      {priceSuffix || "único"}
                    </span>
                  </div>
                  {annualCompare && (
                    <p className="text-[11.5px] text-ink-soft break-words">
                      ≈ {formatBRL(annualCompare.perMonthCents)}/mês
                    </p>
                  )}
                  {plan.description && (
                    <p className="text-[12.5px] text-ink-soft leading-snug mt-0.5 break-words">
                      {plan.description}
                    </p>
                  )}
                </div>

                <ul className="flex flex-col gap-1.5 flex-1">
                  {/* MESMA lista de benefícios da landing — fonte única
                      (LANDING_PLAN_FEATURES). Nada é duplicado à mão. */}
                  {LANDING_PLAN_FEATURES.map((f) => (
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
                  {isCurrent ? "Plano atual" : "Assinar agora"}
                </Button>
              </div>
            );
          })}
        </div>
        {notice && (
          <div
            className={cn(
              "rounded-[12px] border px-4 py-3 text-[13px] flex items-center gap-2",
              notice.kind === "warn" && "border-warn/30 bg-warn-soft text-warn",
              notice.kind === "info" && "border-info/30 bg-info-soft text-info",
              notice.kind === "success" && "border-success/30 bg-success-soft text-success"
            )}
          >
            {notice.kind === "warn" ? (
              <AlertTriangle size={15} className="flex-none" />
            ) : (
              <Info size={15} className="flex-none" />
            )}
            <span>{notice.text}</span>
            {checkoutUrl && (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-auto shrink-0 font-semibold underline underline-offset-2"
              >
                Pagar agora <ExternalLink size={13} />
              </a>
            )}
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
    // `min-w-0` é obrigatório aqui: em grid/flex o item tem `min-width:auto`,
    // então um rótulo longo (ex.: "Pagamento confirmado em") empurra a coluna
    // e estoura o cartão em telas de 320px. Com `min-w-0` + `break-words` o
    // texto quebra dentro da célula em vez de alargar o layout.
    <div className="rounded-[10px] border border-border-soft bg-bg-ice px-3 sm:px-3.5 py-2.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted break-words">{label}</span>
      <div className="text-[13px] text-ink font-medium break-words">{value}</div>
    </div>
  );
}
