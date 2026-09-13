"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onSelect?: () => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  label?: string;
}

/** Dropdown simples (menu) com fechamento ao clicar fora / Esc. */
export function Dropdown({ trigger, items, align = "right", label }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = (
    <div
      role="menu"
      className={cn(
        "absolute top-full mt-2 z-50 min-w-[200px] max-w-[calc(100vw-2rem)] bg-card border border-border-soft rounded-md shadow-lg py-1.5 animate-[fade-slide_.25s_var(--ease-out)]",
        align === "right" ? "right-0" : "left-0"
      )}
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={() => {
            item.onSelect?.();
            setOpen(false);
          }}
          className={cn(
            "w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13.5px] transition-colors cursor-pointer",
            item.danger ? "text-danger hover:bg-danger-softMid" : "text-ink-soft hover:bg-surface hover:text-ink"
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex items-center gap-1 cursor-pointer"
      >
        {trigger}
        <ChevronDown
          size={15}
          className={cn("text-ink-muted transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      {mounted && open && createPortal(menu, ref.current ?? document.body)}
    </div>
  );
}
