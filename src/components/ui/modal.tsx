"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/** Modal acessível com backdrop, esc e bloqueio de scroll. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
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

  if (!mounted) return null;
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={cn(
          "relative z-10 w-full bg-card border border-border-soft rounded-xl shadow-lg animate-[fade-slide_.3s_var(--ease-out)]",
          sizes[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div>
            {title && (
              <h2
                id="modal-title"
                className="font-display text-[18px] font-bold text-ink"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[13px] text-ink-soft mt-1">{description}</p>
            )}
          </div>
          <IconButton label="Fechar" onClick={onClose} className="flex-none">
            <X size={18} />
          </IconButton>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** Aliase semântico: Dialog = Modal. */
export function Dialog(props: ModalProps) {
  return <Modal {...props} />;
}
