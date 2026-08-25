import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio profissional — usado quando ainda não há dados
 * (ex.: Instagram não conectado). Nunca inventa números.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 rounded-md bg-card border border-dashed border-[#D0D4DB]",
        className
      )}
    >
      {Icon && (
        <span className="w-14 h-14 rounded-[18px] bg-surface text-ink-muted grid place-items-center mb-4">
          <Icon size={26} strokeWidth={1.8} />
        </span>
      )}
      <h3 className="font-display text-[15.5px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="text-[13px] text-ink-soft mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  retry?: () => void;
  className?: string;
}

/** Estado de erro — orienta o usuário, nunca apen­as "algo deu errado". */
export function ErrorState({
  title = "Não foi possível carregar",
  description = "Ocorreu um erro ao buscar os dados. Tente novamente em instantes.",
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 rounded-md bg-danger-softMid border border-danger/20",
        className
      )}
    >
      <span className="w-12 h-12 rounded-full bg-danger-soft text-danger grid place-items-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <h3 className="font-display text-[15.5px] font-semibold text-ink">{title}</h3>
      <p className="text-[13px] text-ink-soft mt-1.5 max-w-sm">{description}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-5 inline-flex items-center gap-2 text-[13.5px] font-semibold text-purple hover:text-indigo transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
