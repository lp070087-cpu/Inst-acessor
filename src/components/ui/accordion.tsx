"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/** Item de acordeão acessível (botão + região). */
export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <div className="bg-card border border-border-soft rounded-md shadow-xs overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-surface/50 transition-colors"
      >
        <span className="font-semibold text-[14.5px] text-ink">{title}</span>
        <ChevronDown
          size={18}
          className={cn(
            "text-ink-soft transition-transform duration-300 flex-none",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4 text-[13.5px] text-ink-soft leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AccordionProps {
  items: { title: string; content: React.ReactNode; defaultOpen?: boolean }[];
  className?: string;
}

/** Lista de itens de acordeão. */
export function Accordion({ items, className }: AccordionProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <AccordionItem key={item.title} title={item.title} defaultOpen={item.defaultOpen}>
          {item.content}
        </AccordionItem>
      ))}
    </div>
  );
}
