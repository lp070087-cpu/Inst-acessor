import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
  children?: ReactNode;
}

/**
 * Estado estrutural padrão das páginas do app na Fase 1.
 * Páginas existem como rotas, com identidade visual e mensagem clara
 * de que a funcionalidade chegará nas próximas fases.
 */
export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  className,
  children,
}: PagePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-20 rounded-[22px] bg-card border border-dashed border-[#D0D4DB]",
        className
      )}
    >
      <span className="w-14 h-14 rounded-[18px] bg-ai-soft text-purple grid place-items-center mb-4">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <h1 className="font-display text-[20px] font-bold text-ink">{title}</h1>
      <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-sm">{description}</p>
      {children}
    </div>
  );
}
