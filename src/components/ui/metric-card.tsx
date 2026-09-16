import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  empty?: boolean;
  /** Mensagem exibida quando `empty` (padrão: Instagram, por compatibilidade). */
  emptyMessage?: string;
  className?: string;
}

/**
 * Card de métrica do dashboard.
 * Quando `empty` (sem conexão) exibe "—" com texto neutro,
 * seguindo a regra de NÃO apresentar números fictícios.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  empty = false,
  emptyMessage = "Conecte sua rede social para liberar esta métrica.",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "group relative bg-card border border-border-soft rounded-md p-5 shadow-xs overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
        className
      )}
    >
      {/* linha de gradiente superior no hover */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-brand-grad opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {/* BLOCO 5 — rótulos como "Comentários analisados" não cabem ao lado do
          ícone de 32px quando a grade de 2 colunas cai para ~320px de tela.
          O rótulo pode encolher e quebrar; o ícone fica com largura fixa e não
          é empurrado para fora do card. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12.5px] font-semibold text-ink-soft min-w-0 break-words">{label}</span>
        {Icon ? (
          <span className="w-8 h-8 rounded-[10px] bg-surface text-ink-muted grid place-items-center flex-none">
            <Icon size={16} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="font-data font-bold tracking-tight text-[clamp(24px,3vw,32px)] text-ink">
        {value}
      </div>
      {empty ? (
        <p className="text-[12.5px] text-ink-muted mt-1.5 break-words">{emptyMessage}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-muted mt-1.5 break-words">{hint}</p>
      ) : null}
    </div>
  );
}
