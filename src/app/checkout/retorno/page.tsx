import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  Mail,
  Loader2,
} from "lucide-react";
import Link from "next/link";

import { findCheckoutOrderByReference } from "@/lib/billing/asaas/checkout-order";
import type { CheckoutOrder } from "@/lib/billing/db";

export const metadata: Metadata = {
  title: "Retorno do pagamento",
  description: "Acompanhe o status da sua compra no Inst Acessor.",
};

export const dynamic = "force-dynamic";

/**
 * /checkout/retorno?referencia=... — página pública de RETORNO do checkout
 * =========================================================================
 * É para cá que o Asaas redireciona o comprador ao concluir/cancelar o
 * checkout hospedado (redirectUrl em `buildHostedCheckoutRequest`).
 *
 * REGRA DE OURO (regras 11 e 14 do escopo): o redirect do Asaas NÃO prova
 * pagamento. Esta página apenas lê o estado REAL da ordem local (gravada pelo
 * webhook VALIDADO) e mostra estados honestos:
 *
 *   - ordem PENDING  → "Aguardando confirmação do pagamento" (comum quando o
 *                      webhook ainda não chegou — o redirect volta antes).
 *   - ordem PAID     → pagamento confirmado pelo webhook → link p/ ativar acesso.
 *   - CANCELED       → pagamento cancelado (pode tentar de novo).
 *   - EXPIRED/FAILED → pagamento não concluído (pode tentar de novo).
 *   - REFUNDED       → estorno processado (acesso revogado).
 *   - sem referência / ordem não encontrada → nenhum dado sensível, mensagem neutra.
 *
 * NUNCA marca sucesso aqui; NUNCA libera acesso aqui; NÃO mostra valor do
 * pagamento nem e-mail para não vazar dados de pedidos alheios.
 */
function formatStatus(order: CheckoutOrder): {
  tone: "success" | "pending" | "danger" | "neutral";
  title: string;
  body: string;
  icon: typeof Clock;
} {
  switch (order.status) {
    case "PAID":
      return {
        tone: "success",
        title: "Pagamento confirmado!",
        body: "Seu acesso já foi liberado (ou está sendo processado). Ative sua conta com o e-mail usado na compra.",
        icon: CheckCircle2,
      };
    case "PENDING":
      return {
        tone: "pending",
        title: "Aguardando confirmação do pagamento",
        body: "Recebemos seu pedido, mas a confirmação do banco ainda não chegou. Assim que o pagamento for confirmado, seu acesso é liberado automaticamente — não é preciso fazer mais nada.",
        icon: Clock,
      };
    case "CANCELED":
      return {
        tone: "neutral",
        title: "Pagamento cancelado",
        body: "Você cancelou o pagamento. Nenhum valor foi cobrado. Pode escolher o plano e tentar novamente quando quiser.",
        icon: XCircle,
      };
    case "REFUNDED":
      return {
        tone: "danger",
        title: "Pagamento estornado",
        body: "Este pagamento foi estornado e o acesso correspondente foi revogado. Se tiver dúvidas, fale com a gente.",
        icon: ShieldAlert,
      };
    case "FAILED":
    case "EXPIRED":
      return {
        tone: "neutral",
        title: "Pagamento não concluído",
        body: "O pagamento não foi concluído. Nenhum valor foi cobrado. Escolha o plano e tente novamente.",
        icon: RotateCcw,
      };
    default:
      return {
        tone: "neutral",
        title: "Pedido recebido",
        body: "Estamos processando sua solicitação. Acompanhe por e-mail ou tente novamente em instantes.",
        icon: Clock,
      };
  }
}

export default async function RetornoPage({
  searchParams,
}: {
  searchParams: { referencia?: string };
}) {
  const ref = (searchParams?.referencia ?? "").trim();

  let order: CheckoutOrder | null = null;
  if (ref) {
    order = await findCheckoutOrderByReference(ref);
  }
  if (!order) {
    notFound();
  }

  const s = formatStatus(order);
  const Icon = s.icon;

  // link "verificar de novo" com cache-bust para reconsultar o webhook já entregue.
  const retryHref = `/checkout/retorno?referencia=${encodeURIComponent(ref)}&t=${Date.now()}`;
  // Link do plano escolhido (para "tentar de novo" quando cancelado/expirou).
  const checkoutHref = `/checkout?plano=${encodeURIComponent(order.planSlug)}`;

  return (
    <div className="bg-card border border-border-soft rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-grad" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Status da compra
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 text-center py-6">
        <span
          className={
            "grid w-16 h-16 place-items-center rounded-full " +
            (s.tone === "success"
              ? "bg-success/10 text-success"
              : s.tone === "pending"
              ? "bg-warn-soft text-warn"
              : s.tone === "danger"
              ? "bg-danger/10 text-danger"
              : "bg-border/30 text-ink-soft")
          }
        >
          <Icon size={34} strokeWidth={1.6} />
        </span>

        <div>
          <h1 className="font-display text-[24px] font-bold text-ink">{s.title}</h1>
          <p className="text-[14px] text-ink-soft leading-relaxed max-w-[400px] mt-2">
            {s.body}
          </p>
        </div>

        {/* Resumo neutro do pedido (sem valor/email para não vazar dados) */}
        <div className="w-full rounded-[14px] border border-border bg-bg-ice/60 p-4 mt-1 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-ink-muted">Plano</p>
              <p className="font-semibold text-ink mt-0.5">{order.planName ?? "Inst Acessor"}</p>
            </div>
            <div>
              <p className="text-ink-muted">Pedido</p>
              <p className="font-semibold text-ink mt-0.5 font-mono text-[12px] truncate" title={order.externalReference}>
                {order.externalReference.slice(0, 18)}…
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full mt-3">
          {s.tone === "success" ? (
            <>
              <Link
                href="/primeiro-acesso"
                className="inline-flex items-center justify-center gap-2 w-full rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white shadow-brand px-8 py-4 text-[16.5px] font-semibold hover:bg-[position:100%_100%] transition-all duration-300"
              >
                Ativar meu acesso <ArrowRight size={18} />
              </Link>
              <p className="text-[12.5px] text-ink-muted">
                Já tem conta?{" "}
                <Link href="/login" className="font-semibold text-purple hover:text-indigo">
                  Entrar
                </Link>
              </p>
            </>
          ) : s.tone === "pending" ? (
            <>
              <Link
                href={retryHref}
                className="inline-flex items-center justify-center gap-2 w-full rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white shadow-brand px-8 py-4 text-[16.5px] font-semibold hover:bg-[position:100%_100%] transition-all duration-300"
              >
                <Loader2 size={18} className="animate-spin" /> Verificar novamente
              </Link>
              <p className="text-[12.5px] text-ink-muted flex items-start gap-1.5 max-w-[360px]">
                <Mail size={14} className="flex-none mt-0.5 text-purple" />
                <span>
                  A confirmação costuma chegar em instantes. Você também receberá um e-mail
                  quando o acesso estiver liberado.
                </span>
              </p>
            </>
          ) : (
            <>
              <Link
                href={checkoutHref}
                className="inline-flex items-center justify-center gap-2 w-full rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white shadow-brand px-8 py-4 text-[16.5px] font-semibold hover:bg-[position:100%_100%] transition-all duration-300"
              >
                Tentar novamente <ArrowRight size={18} />
              </Link>
              <p className="text-[12.5px] text-ink-muted">
                Prefere outro plano?{" "}
                <Link href="/#planos" className="font-semibold text-purple hover:text-indigo">
                  Ver planos
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
