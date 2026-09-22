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
import {
  formatBRL,
  planPeriodLabel,
  planPriceSuffix,
  planShortName,
} from "@/lib/billing/plans/display";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// Máscaras de entrada (somente exibição — o valor enviado ao
// servidor é SEMPRE normalizado para DDD+número, sem prefixo 55,
// no backend — formato esperado pelo checkout do Asaas).
// ------------------------------------------------------------

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/** CPF (11) ou CNPJ (14) — máscara aplicada conforme o tamanho. */
function maskCpfCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Telefone/WhatsApp com DDD — (11) 99999-9999. */
function maskPhone(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CEP — 00000-000. */
function maskCep(value: string): string {
  const d = digitsOnly(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

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
  /**
   * Planos que o seletor "Trocar de plano" pode oferecer.
   *
   * Chega VAZIO quando não há sessão válida. Sem o seletor, o e-mail que o
   * visitante digitar é o único caminho possível para a compra e para o
   * acesso — não há como trocar de plano e acabar usando outra identidade por
   * engano.
   */
  activePlans: PlanView[];
  /** Comprador já autenticado? Se sim, o servidor usa a sessão como fonte de verdade. */
  authedEmail: string | null;
  authedName: string | null;
  /**
   * Preço que o SERVIDOR já resolveu para ESTA compra deste comprador, no
   * plano da página (`?plano=...`).
   *
   * Difere do preço do catálogo quando a pré-venda vale — e a elegibilidade
   * (primeira compra, cobranças já usadas) só o servidor conhece. Sem isto, o
   * resumo e o rodapé do formulário mostravam o valor CHEIO enquanto a faixa
   * acima anunciava o desconto, e o Asaas cobraria um terceiro valor.
   *
   * É INFORMATIVO: quem cobra é `startPublicCheckout`, que resolve o preço de
   * novo no clique. Se o prazo vencer nesse intervalo, vale o preço cheio.
   */
  pricing: CheckoutPricing;
}

/** Cotação de UMA compra, resolvida no servidor para o plano da página. */
export interface CheckoutPricing {
  /** Slug do plano a que esta cotação se refere. */
  slug: string;
  /** Preço cheio do catálogo (mostrado riscado quando há desconto). */
  baseCents: number;
  /** Preço que será cobrado: igual ao cheio quando não há desconto. */
  effectiveCents: number;
  /** `true` somente quando houve desconto real. */
  onSale: boolean;
  /** Prazo da campanha (ISO) — `null` quando não há. */
  countdownEndsAt: string | null;
  /** Rótulo do contador, configurado pelo ADMIN. */
  countdownLabel: string;
  /** `true` quando o prazo está ativo e ainda não venceu. */
  countdownRunning: boolean;
}

type NoticeState =
  | { kind: "loading"; text: string }
  | { kind: "info"; text: string; url?: string | null }
  | { kind: "warn"; text: string }
  | { kind: "error"; text: string }
  | null;

export function CheckoutForm({
  plan,
  activePlans,
  authedEmail,
  authedName,
  pricing,
}: CheckoutFormProps) {
  const { toast } = useToast();

  const [selectedId, setSelectedId] = React.useState<string>(plan.id);
  const [name, setName] = React.useState(authedName ?? "");
  // O e-mail do formulário NUNCA é pré-preenchido a partir de outra origem que
  // não seja a sessão ATUAL verificada no servidor. Não há persistência local
  // (nem localStorage/sessionStorage) e nenhum efeito hidrata este campo depois
  // — assim um visitante anônimo não vê o e-mail de uma conta que não é dele.
  const [email, setEmail] = React.useState(authedEmail ?? "");
  const [cpfCnpj, setCpfCnpj] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [addressNumber, setAddressNumber] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<NoticeState>(null);

  // O seletor só troca entre os planos que o usuário pode escolher AQUI.
  // Sem sessão `activePlans` é vazio, então cai sempre em `plan` — exatamente o
  // plano que veio da landing.
  const selected = activePlans.find((p) => p.id === selectedId) ?? plan;

  // COTAÇÃO VIGENTE deste formulário.
  //
  // Enquanto o comprador não troca de plano, vale a cotação do servidor
  // recebida por prop — ela já considera o histórico dele. Se ele TROCA de
  // plano no seletor, esta página não tem cotação para o outro plano (o
  // servidor cotou apenas o da URL): mostramos o preço de catálogo e nada de
  // "riscado". Prometer desconto para um plano que não foi cotado seria
  // anunciar um valor que o checkout não necessariamente cobraria.
  const usesPagePricing = selected.slug === pricing.slug;
  const effectiveCents = usesPagePricing ? pricing.effectiveCents : selected.priceCents;
  const onSale = usesPagePricing && pricing.onSale;
  const baseCents = usesPagePricing ? pricing.baseCents : selected.priceCents;

  async function continueToPayment(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    // Guarda de consistência: só é possível chegar aqui sem e-mail quando a
    // sessão não foi confirmada pelo servidor. Não seguimos com uma identidade
    // desconhecida.
    if (!authedEmail && !email.trim()) {
      setNotice({
        kind: "error",
        text: "Informe seu e-mail para continuar. É com ele que seu acesso será liberado.",
      });
      return;
    }

    // Dados obrigatórios do comprador (apenas fluxo anônimo) — validação de
    // preenchimento espelhando o servidor. Nada é logado.
    if (!authedEmail) {
      const requiredBuyer: Array<{ value: string; label: string }> = [
        { value: cpfCnpj, label: "CPF ou CNPJ" },
        { value: phone, label: "Telefone" },
        { value: postalCode, label: "CEP" },
        { value: address, label: "Endereço" },
        { value: addressNumber, label: "Número" },
        { value: province, label: "Bairro" },
      ];
      const missing = requiredBuyer.find((f) => !f.value.trim());
      if (missing) {
        setNotice({
          kind: "error",
          text: `Informe ${missing.label} para concluir o pagamento.`,
        });
        return;
      }
    }

    setLoading(true);
    try {
      // `email` e os dados do comprador SÓ são enviados quando não há sessão
      // (Cenário B). Com sessão, o servidor usa a identidade da sessão como
      // fonte de verdade e ignora qualquer dado vindo do navegador — nunca
      // sobrescrevemos a conta de quem já está logado.
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selected.id,
          name: name.trim() || null,
          ...(authedEmail
            ? {}
            : {
                email: email.trim(),
                cpfCnpj: cpfCnpj.trim(),
                phone: phone.trim(),
                postalCode: postalCode.trim(),
                address: address.trim(),
                addressNumber: addressNumber.trim(),
                province: province.trim(),
              }),
        }),
      });
      const data = await res.json();

      if (data?.status === "INTEGRATION_NOT_CONFIGURED") {
        // Estado controlado — nenhuma cobrança foi feita.
        setNotice({
          kind: "warn",
          text: `${planShortName(selected)} — ${formatBRL(effectiveCents)}. Pagamento online em configuração. Nenhuma cobrança foi feita.`,
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
          <p className="font-display text-[16px] font-bold text-ink leading-tight break-words">
            {planShortName(selected)}
          </p>
          <p className="text-[12px] text-ink-soft break-words">{planPeriodLabel(selected)}</p>
        </div>
        <div className="text-right shrink-0">
          {/* Preço cheio riscado quando a pré-venda vale NESTA compra. */}
          {onSale && (
            <p className="text-[11px] text-ink-muted line-through leading-none mb-1">
              {formatBRL(baseCents)}
            </p>
          )}
          {/* BLOCO 5 — preço atômico: não quebra entre o símbolo e o número. */}
          <p
            className={cn(
              "font-display text-[19px] font-bold leading-none whitespace-nowrap",
              onSale ? "text-purple" : "text-ink"
            )}
          >
            {formatBRL(effectiveCents)}
          </p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {planPriceSuffix(selected) || "único"}
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
            <p className="text-[14px] font-semibold text-ink break-all">{authedEmail}</p>
            <p className="text-[11.5px] text-ink-muted mt-0.5">
              Sua assinatura será atualizada nesta mesma conta — você não precisa
              informar e-mail.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* CENÁRIO B — VISITANTE SEM SESSÃO.
              O formulário pede o e-mail que receberá o acesso e mostra, em
              texto, exatamente com que identidade a compra está sendo feita.
              Nada é herdado de sessão anterior: o campo começa vazio. */}
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
              className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <label htmlFor="checkout-email" className="text-[13px] font-semibold text-ink">
                Seu e-mail <span className="text-ink-muted font-normal">(obrigatório)</span>
              </label>
              <span className="text-[11.5px] text-ink-muted">onde seu acesso será liberado</span>
            </div>
            <input
              id="checkout-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              required
            />
            <p className="text-[11.5px] text-ink-muted leading-relaxed min-w-0 break-words">
              É com este e-mail que você vai ativar seu acesso depois do pagamento —
              não é preciso ter conta antes.
            </p>
          </div>

          {/* Dados obrigatórios do comprador (checkout hospedado do Asaas).
              Layout premium e compacto: pares em grade no desktop, empilhados
              no mobile. Valores exibidos sem normalização inesperada — a
              normalização (DDD+número, sem prefixo 55) acontece só no servidor. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-cpfcnpj" className="text-[13px] font-semibold text-ink">
                CPF ou CNPJ <span className="text-ink-muted font-normal">(obrigatório)</span>
              </label>
              <input
                id="checkout-cpfcnpj"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
                className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-phone" className="text-[13px] font-semibold text-ink">
                Telefone / WhatsApp <span className="text-ink-muted font-normal">(obrigatório)</span>
              </label>
              <input
                id="checkout-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkout-cep" className="text-[13px] font-semibold text-ink">
              CEP <span className="text-ink-muted font-normal">(obrigatório)</span>
            </label>
            <input
              id="checkout-cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(maskCep(e.target.value))}
              placeholder="00000-000"
              className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-address" className="text-[13px] font-semibold text-ink">
                Endereço <span className="text-ink-muted font-normal">(obrigatório)</span>
              </label>
              <input
                id="checkout-address"
                type="text"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua / Avenida"
                className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-address-number" className="text-[13px] font-semibold text-ink">
                Número <span className="text-ink-muted font-normal">(obrigatório)</span>
              </label>
              <input
                id="checkout-address-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="123"
                className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkout-province" className="text-[13px] font-semibold text-ink">
              Bairro <span className="text-ink-muted font-normal">(obrigatório)</span>
            </label>
            <input
              id="checkout-province"
              type="text"
              autoComplete="off"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Seu bairro"
              className="h-12 w-full min-w-0 rounded-[12px] border border-border bg-bg-ice px-4 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow"
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

      {/* Troca rápida de plano — só existe quando há uma sessão verificada.
          Sem sessão (Cenário B) o visitante confirma o plano escolhido na
          landing; o seletor some para que o e-mail digitado seja a única
          identidade possível desta compra. */}
      {activePlans.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">Trocar de plano</span>
          {/* Colapsa para 1 coluna no celular: com 3 colunas fixas sobram ~56px
              por card a 320px, menos que o min-content de "R$ 47,00". */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {activePlans.map((p) => {
              const isSel = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2.5 text-left transition-all duration-200 cursor-pointer min-w-0",
                    isSel
                      ? "border-purple/60 bg-purple/5 ring-1 ring-purple/20"
                      : "border-border bg-bg-ice/50 hover:border-purple/30"
                  )}
                >
                  <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink min-w-0">
                    {p.slug === "mensal" && <Zap size={12} className="text-purple flex-none" />}
                    {p.slug === "anual" && <Crown size={12} className="text-purple flex-none" />}
                    {p.slug === "semanal" && (
                      <CalendarClock size={12} className="text-purple flex-none" />
                    )}
                    <span className="truncate">{planShortName(p)}</span>
                  </span>
                  {/* Só o plano COTADO pelo servidor tem preço com desconto a
                      mostrar; os outros aparecem pelo catálogo — o valor real
                      será resolvido no clique. */}
                  <span className="text-[12px] font-bold text-ink-soft whitespace-nowrap">
                    {formatBRL(
                      p.slug === pricing.slug && pricing.onSale
                        ? pricing.effectiveCents
                        : p.priceCents
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Checklist silencioso para transparência. Reflete o plano realmente
          selecionado: o semanal é pagamento único e não tem renovação para
          cancelar; prometer cancelamento ali seria informação incorreta. */}
      <ul className="flex flex-col gap-1 text-[11.5px] text-ink-muted mt-1">
        {selected.type === "RECURRING" ? (
          <>
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-success flex-none" /> Sem renovação automática sem o seu aval
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} className="text-success flex-none" /> Cancele quando quiser
            </li>
          </>
        ) : (
          <li className="flex items-start gap-1.5">
            <Check size={12} className="text-success flex-none mt-0.5" />
            <span className="min-w-0 break-words">
              Pagamento único de {formatBRL(effectiveCents)} — sem renovação
              automática e sem cobrança recorrente.
            </span>
          </li>
        )}
      </ul>
    </form>
  );
}
