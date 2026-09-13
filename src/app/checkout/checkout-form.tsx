"use client";

import * as React from "react";
import {
  Loader2,
  ShieldCheck,
  Lock,
  Mail,
  Check,
  Info,
  AlertTriangle,
  Wallet,
  ExternalLink,
  CreditCard,
  Zap,
  Crown,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * CHECKOUT PÚBLICO — FORMULÁRIO (Asaas / checkout hospedado)
 * ==========================================================
 * Fluxo oficial: o visitante escolhe um plano na landing (/checkout?plano=slug),
 * informa nome (opcional) + e-mail (obrigatório quando não autenticado) e toca
 * em "Continuar para o pagamento".
 *
 * O servidor resolve o preço/duração/ciclo no catálogo (nunca no navegador),
 * cria o checkout hospedado no Asaas e devolve uma URL pública. Este
 * componente abre essa URL em nova aba e mostra estados HONESTOS:
 *
 *   - INTEGRATION_NOT_CONFIGURED → pagamento em configuração; nada foi cobrado.
 *   - checkoutUrl presente        → usuário é levado ao checkout do Asaas.
 *   - erro                        → mensagem clara, nada de cobrança fake.
 *
 * NENHUM estado de "aprovado" é exibido aqui: aprovação só existe por webhook
 * validado (a página /checkout/retorno mostra o estado REAL da ordem local).
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
  badge: string | null;
}

interface CheckoutFormProps {
  plan: PlanView;
  plans: PlanView[];
  /** Comprador já autenticado? Se sim, o servidor usa a sessão como fonte de verdade. */
  authedEmail: string | null;
  authedName: string | null;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function periodLabel(plan: PlanView): string {
  if (plan.type !== "RECURRING") return "pagamento único · acesso de 7 dias";
  if (plan.billingInterval === "YEAR") return "cobrança anual · acesso por 12 meses";
  if (plan.billingInterval === "MONTH") return "cobrança mensal recorrente";
  return "recorrente";
}

type NoticeState =
  | { kind: "loading"; text: string }
  | { kind: "info"; text: string; url?: string | null }
  | { kind: "warn"; text: string }
  | { kind: "error"; text: string }
  | null;

export function CheckoutForm({ plan, plans, authedEmail, authedName }: CheckoutFormProps) {
  const { toast } = useToast();

  const [selectedId, setSelectedId] = React.useState<string>(plan.id);
  const [name, setName] = React.useState(authedName ?? "");
  const [email, setEmail] = React.useState(authedEmail ?? "");
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<NoticeState>(null);

  const selected = plans.find((p) => p.id === selectedId) ?? plan;

  async function continueToPayment(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!email.trim()) {
      setNotice({ kind: "error", text: "Informe seu e-mail para continuar. É com ele que seu acesso será liberado." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected.id, name: name.trim() || null, email: email.trim() }),
      });
      const data = await res.json();

      if (data?.status === "INTEGRATION_NOT_CONFIGURED") {
        // Estado controlado — nenhuma cobrança foi feita.
        setNotice({
          kind: "warn",
          text: `${selected.name} — ${formatBRL(selected.priceCents)}. Pagamento online em configuração. Nenhuma cobrança foi feita.`,
        });
        toast("Pagamento online em configuração.");
        return;
      }

      if (!res.ok || !data?.ok) {
        setNotice({ kind: "error", text: data?.error ?? data?.message ?? "Não foi possível iniciar o pagamento." });
        return;
      }

      const url = data?.checkout?.checkoutUrl;
      setNotice({
        kind: "info",
        text: "Checkout criado. Conclua o pagamento na página segura do Asaas.",
        url,
      });

      if (typeof url === "string" && url) {
        toast("Redirecionando para o pagamento seguro…");
        // Nova aba: o cliente volta à /checkout/retorno ao concluir/cancelar.
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast("Checkout criado. Aguardando pagamento.");
      }
    } catch {
      setNotice({ kind: "error", text: "Não foi possível iniciar o pagamento. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={continueToPayment} className="flex flex-col gap-5" noValidate>
      {/* Resumo do plano escolhido */}
      <div className="rounded-[16px] border border-border-soft bg-bg-ice/70 p-4 flex items-center gap-3.5">
        <span className="grid w-11 h-11 shrink-0 place-items-center rounded-[12px] bg-brand-grad text-white shadow-brand">
          <CreditCard size={20} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-bold text-ink leading-tight truncate">
            {selected.name}
          </p>
          <p className="text-[12px] text-ink-soft">{periodLabel(selected)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-[19px] font-bold text-ink leading-none">
            {formatBRL(selected.priceCents)}
          </p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {selected.type === "RECURRING"
              ? selected.billingInterval === "YEAR"
                ? "/ano"
                : "/mês"
              : "único"}
          </p>
        </div>
      </div>

      {authedEmail ? (
        <div className="rounded-[12px] border border-border bg-bg-ice/60 px-4 py-3 flex items-center gap-3">
          <span className="grid w-9 h-9 place-items-center rounded-[10px] bg-brand-grad text-white shrink-0">
            <Mail size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] text-ink-soft">Compra vinculada à sua conta</p>
            <p className="text-[14px] font-semibold text-ink truncate">{authedEmail}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkout-name" className="text-[13px] font-semibold text-ink">
              Seu nome <span className="text-ink-muted font-normal">(opcional)</span>
            </label>
            <input
              id="checkout-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como podemos te chamar?"
              className="h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="checkout-email" className="text-[13px] font-semibold text-ink">
                E-mail
              </label>
              <span className="text-[11.5px] text-ink-muted">onde seu acesso será liberado</span>
            </div>
            <input
              id="checkout-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-12 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              required
            />
          </div>
        </>
      )}

      {!authedEmail && (
        <div className="flex items-start gap-2.5 rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
          <Info size={15} strokeWidth={1.9} className="flex-none mt-0.5" />
          <p>
            <strong className="font-semibold">Importante:</strong> use um e-mail que você tenha
            acesso. Após a confirmação do pagamento, é com ele que você ativa seu acesso — sem
            precisar ter conta antes.
          </p>
        </div>
      )}

      {/* Troca rápida de plano */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-soft">Trocar de plano</span>
        {/* Colapsa para 1 coluna no celular: com 3 colunas fixas sobram ~56px
            por card a 320px, menos que o min-content de "R$ 47,00". */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {plans.map((p) => {
            const isSel = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2.5 text-left transition-all duration-200 cursor-pointer",
                  isSel
                    ? "border-purple/60 bg-purple/5 ring-1 ring-purple/20"
                    : "border-border bg-bg-ice/50 hover:border-purple/30"
                )}
              >
                <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink">
                  {p.slug === "mensal" && <Zap size={12} className="text-purple" />}
                  {p.slug === "anual" && <Crown size={12} className="text-purple" />}
                  {p.slug === "semanal" && <CalendarClock size={12} className="text-purple" />}
                  {p.name.replace(/^Inst acessor\s*/i, "")}
                </span>
                <span className="text-[12px] font-bold text-ink-soft">{formatBRL(p.priceCents)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            "rounded-[12px] border px-4 py-3 text-[13px] flex flex-wrap items-center gap-2",
            notice.kind === "info" && "border-info/30 bg-info-soft text-info",
            notice.kind === "warn" && "border-warn/30 bg-warn-soft text-warn",
            (notice.kind === "error" || notice.kind === "loading") && "border-danger/20 bg-danger-softStrong text-danger"
          )}
        >
          {notice.kind === "error" || notice.kind === "loading" ? (
            <AlertTriangle size={15} className="flex-none" />
          ) : notice.kind === "warn" ? (
            <AlertTriangle size={15} className="flex-none" />
          ) : (
            <Info size={15} className="flex-none" />
          )}
          <span className="flex-1 min-w-0 break-words">{notice.text}</span>
          {notice.kind === "info" && notice.url && (
            <a
              href={notice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-auto shrink-0 font-semibold underline underline-offset-2"
            >
              Ir para o pagamento <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
        {loading ? "Criando checkout…" : "Continuar para o pagamento"}
      </Button>

      <div className="flex items-start gap-2.5 text-[12px] text-ink-muted">
        <ShieldCheck size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-success" />
        <p>
          Pagamento processado com segurança pelo Asaas. Nenhum dado de cartão passa pelo Inst
          Acessor. Seu acesso é liberado somente após a confirmação real do pagamento.
        </p>
      </div>

      <div className="flex items-start gap-2.5 text-[12px] text-ink-muted">
        <Lock size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-purple" />
        <p>Não é preciso ter conta para comprar — ela é criada por você, com sua senha, depois do pagamento.</p>
      </div>

      <p className="text-center text-[13px] text-ink-soft">
        Já tem conta?{" "}
        <a href="/login" className="font-semibold text-purple hover:text-indigo">
          Entrar
        </a>
      </p>

      {/* Checklist silencioso para transparência */}
      <ul className="flex flex-col gap-1 text-[11.5px] text-ink-muted mt-1">
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-success" /> Sem renovação automática sem o seu aval
        </li>
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-success" /> Cancele quando quiser
        </li>
      </ul>
    </form>
  );
}
