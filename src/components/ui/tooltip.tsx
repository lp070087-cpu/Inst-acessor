"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

/** Tooltip simples via CSS (hover/focus), sem dependências. */
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-[10px] bg-ink text-white text-[12px] font-medium px-3 py-1.5 shadow-md opacity-0 translate-y-1 scale-95 transition-all duration-200 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:scale-100 group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0 group-focus-within/tip:scale-100"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-ink" />
      </span>
    </span>
  );
}
