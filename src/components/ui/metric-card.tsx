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
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] font-semibold text-ink-soft">{label}</span>
        {Icon ? (
          <span className="w-8 h-8 rounded-[10px] bg-surface text-ink-muted grid place-items-center">
            <Icon size={16} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="font-data font-bold tracking-tight text-[clamp(24px,3vw,32px)] text-ink">
        {value}
      </div>
      {empty ? (
        <p className="text-[12.5px] text-ink-muted mt-1.5">{emptyMessage}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-muted mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
