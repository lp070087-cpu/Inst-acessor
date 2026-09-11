"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  activeClassName?: string;
}

/**
 * Abas estilo "pill" — visual idêntico às abas da apresentação
 * (timeline / histórico): fundo surface, ativo com card + sombra.
 */
export function Tabs({
  tabs,
  activeId,
  onChange,
  className,
  activeClassName,
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto bg-surface border border-border-soft rounded-pill p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap text-[13.5px] font-semibold text-ink-soft px-4 py-2 rounded-pill transition-all duration-300 cursor-pointer",
              active
                ? cn("bg-card text-ink shadow-xs", activeClassName)
                : "hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
