import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/**
 * Botão de ícone acessível (aria-label obrigatório via `label`).
 */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center w-10 h-10 rounded-[12px] border border-border bg-card text-ink-soft shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:text-ink hover:shadow-sm hover:border-[#D6D9E0] cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
