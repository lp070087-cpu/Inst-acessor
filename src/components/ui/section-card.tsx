import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Card de seção com cabeçalho opcional (título, descrição, ação à direita).
 */
export function SectionCard({
  title,
  description,
  action,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border-soft rounded-lg shadow-xs",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
          <div>
            {title && (
              <h3 className="font-display text-[16px] font-semibold text-ink">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[13px] text-ink-soft mt-0.5">{description}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 flex-none">{action}</div>}
        </div>
      )}
      {children && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}
