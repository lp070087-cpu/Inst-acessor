import * as React from "react";
import { cn } from "@/lib/utils";

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  vertical?: boolean;
  label?: string;
}

/** Divisor — linha sutil (borda clara da identidade). */
export function Divider({ vertical, label, className, ...props }: DividerProps) {
  if (vertical) {
    return <div className={cn("w-px bg-border-soft self-stretch", className)} {...props} />;
  }
  return (
    <div className={cn("flex items-center gap-3 w-full", className)} {...props}>
      {label ? (
        <>
          <span className="flex-1 h-px bg-border-soft" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {label}
          </span>
          <span className="flex-1 h-px bg-border-soft" />
        </>
      ) : (
        <span className="flex-1 h-px bg-border-soft" />
      )}
    </div>
  );
}
