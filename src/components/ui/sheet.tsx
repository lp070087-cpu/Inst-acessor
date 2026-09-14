"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right" | "bottom";
  className?: string;
}

const sideClass = {
  left: "inset-y-0 left-0 h-full w-full max-w-sm",
  right: "inset-y-0 right-0 h-full w-full max-w-sm",
  // `dvh` em vez de `vh`: no iOS a barra do Safari muda a altura útil e
  // `vh` deixa o rodapé do drawer escondido atrás dela.
  bottom: "inset-x-0 bottom-0 max-h-[85dvh]",
};

/**
 * Sheet (drawer) — usado na sidebar mobile do app e em overlays.
 * Sem dependências externas; animação de entrada via keyframes CSS.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "left",
  className,
}: SheetProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute bg-card border-border-soft shadow-lg flex flex-col",
          sideClass[side],
          className
        )}
      >
        {(title || true) && (
          <div className="flex items-center justify-between px-5 h-16 border-b border-border-soft flex-none">
            <h2 className="font-display text-[16px] font-bold text-ink">{title}</h2>
            <IconButton label="Fechar" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-w-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}
