"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * CONTADOR DA PRÉ-VENDA
 * =====================
 * Mostra quanto tempo falta para a promoção terminar, com o formato pedido:
 *
 *     PRÉ-VENDA TERMINA EM 02d : 14h : 32m : 08s
 *
 * COMO ELE SE RELACIONA COM O PREÇO (importante)
 * ----------------------------------------------
 * Este componente NÃO decide nada sobre preço. Ele apenas EXIBE o prazo que o
 * servidor já avaliou. Quando o contador chega a zero, o preço promocional
 * continua sendo recusado no BACKEND de qualquer forma (`resolvePromoPrice` e
 * `acceptableChargeAmounts` olham a hora no servidor) — esta tela só deixa de
 * anunciar a oferta para não prometer o que o checkout não cobraria.
 *
 * O `endsAt` vem do servidor (`SystemSetting`, configurado pelo ADMIN). Sem
 * prazo definido, o componente não renderiza NADA — nunca inventa data.
 */

interface PromoCountdownProps {
  /** ISO 8601 do fim da promoção, vindo do servidor. `null` = sem prazo. */
  endsAt?: string | null;
  /** Texto do rótulo configurado pelo ADMIN (ex.: "PRÉ-VENDA"). */
  label?: string | null;
  className?: string;
  /**
   * Chamado UMA vez, no instante em que o contador zera enquanto a página está
   * aberta. Serve para a tela se atualizar sozinha: sem isso, quem ficou com a
   * página aberta continuaria vendo o preço promocional depois do prazo, mesmo
   * com o backend já cobrando o preço cheio.
   *
   * Não é usado para recusar preço — quem recusa é o servidor.
   */
  onExpire?: () => void;
  /**
   * Atalho para componentes de SERVIDOR (landing, checkout público): ao expirar,
   * chama `router.refresh()` para o servidor recalcular a página. É o que impede
   * o preço promocional de continuar na tela depois do prazo só porque a aba
   * ficou aberta — o backend já cobraria o valor cheio.
   *
   * Ignorado quando `onExpire` também é passado (o chamador manda).
   */
  refreshOnExpire?: boolean;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

/** Diferença pura entre dois instantes — separada para poder ser conferida. */
function remainingUntil(endsAtMs: number, nowMs: number): Remaining {
  const total = Math.floor((endsAtMs - nowMs) / 1000);
  if (!Number.isFinite(total) || total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: false,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function PromoCountdown({
  endsAt,
  label,
  className,
  onExpire,
  refreshOnExpire,
}: PromoCountdownProps) {
  // O primeiro render usa o MESMO instante do servidor para não haver
  // divergência de hidratação: o intervalo só começa depois de montar.
  const router = useRouter();

  const endMs = React.useMemo(() => {
    if (!endsAt) return null;
    const t = new Date(endsAt).getTime();
    return Number.isNaN(t) ? null : t;
  }, [endsAt]);

  const [nowMs, setNowMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (endMs == null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endMs]);

  // Enquanto não montou, tratamos como "falta" — o valor exato aparece no
  // primeiro tick, um instante depois. Melhor que piscar um zero falso.
  const remaining =
    endMs == null || nowMs == null
      ? { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false }
      : remainingUntil(endMs, nowMs);

  // Avisa a tela UMA única vez, no instante em que o prazo zera com a página
  // aberta. O `ref` evita disparar de novo a cada segundo (e a cada render).
  const expiredNotified = React.useRef(false);
  const expired = endMs != null && remaining.expired;
  React.useEffect(() => {
    if (!expired || expiredNotified.current) return;
    expiredNotified.current = true;
    if (onExpire) {
      onExpire();
      return;
    }
    // Sem callback explícito, o `refreshOnExpire` pede ao SERVIDOR a página
    // atualizada. `router.refresh()` só re-renderiza a árvore de servidor —
    // não perde estado de cliente nem navega — e é o caminho que garante que o
    // preço volte ao cheio pela MESMA fonte que cobra.
    if (refreshOnExpire) router.refresh();
  }, [expired, onExpire, refreshOnExpire, router]);

  if (endMs == null) return null;

  // Promoção vencida: o componente desaparece. O preço já voltou ao cheio no
  // servidor, então anunciar a oferta seria uma promessa que o checkout não
  // cumpre.
  if (remaining.expired) return null;

  const prefix = (label?.trim() || "PRÉ-VENDA").toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border border-ai/25 bg-ai-soft px-3 py-1.5",
        className
      )}
      role="timer"
      aria-live="off"
    >
      <Clock size={13} className="text-purple flex-none" />
      <span className="text-[11px] font-bold tracking-wider text-purple">
        {prefix} TERMINA EM
      </span>
      <span className="text-[12px] font-bold text-ink tabular-nums">
        {pad(remaining.days)}d : {pad(remaining.hours)}h : {pad(remaining.minutes)}m :{" "}
        {pad(remaining.seconds)}s
      </span>
    </div>
  );
}

/** Versão do cálculo exposta para conferência por execução. */
export const __remainingUntil = remainingUntil;
