import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Ícone da seção — renderizado em um tile suave na cor da marca. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Ação à direita em telas largas (badge de status, botão…). */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das páginas internas do app.
 *
 * Por que existe: a mesma hierarquia (ícone + título + subtítulo) estava
 * reescrita em cada página com QUATRO variações diferentes — só `<h1>`, ícone
 * de 26px solto ao lado do texto, título dentro do painel escuro e ícone em
 * tile. O resultado era um app com 21 cabeçalhos parecidos e nenhum igual.
 * Aqui há UMA forma: tile de ícone na cor da marca, título e subtítulo curto.
 *
 * É um componente de servidor — só marcação, nenhum estado, nenhum efeito.
 * O `break-words` cobre títulos longos em telas de 360px e o `max-w-[72ch]`
 * impede que o subtítulo vire uma linha de 1600px no desktop largo.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon ? (
          <span className="w-11 h-11 rounded-[13px] bg-ai-soft text-purple grid place-items-center flex-none">
            <Icon size={21} strokeWidth={2} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold text-ink break-words">
            {title}
          </h1>
          {description ? (
            <p className="text-[13.5px] text-ink-soft mt-1 max-w-[72ch] break-words">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex items-center gap-2 flex-wrap flex-none">{action}</div>
      ) : null}
    </div>
  );
}
