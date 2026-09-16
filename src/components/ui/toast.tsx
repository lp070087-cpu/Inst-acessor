"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}

const toneConfig: Record<ToastTone, { icon: typeof CheckCircle2; ring: string; iconCls: string }> = {
  success: { icon: CheckCircle2, ring: "border-success/30", iconCls: "text-success" },
  error: { icon: XCircle, ring: "border-danger/30", iconCls: "text-danger" },
  warning: { icon: AlertTriangle, ring: "border-warn/30", iconCls: "text-warn" },
  info: { icon: Info, ring: "border-info/30", iconCls: "text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove]
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] sm:w-auto mb-[env(safe-area-inset-bottom)]">
            {items.map((t) => {
              const cfg = toneConfig[t.tone];
              const Icon = cfg.icon;
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    "flex items-start gap-3 bg-card border rounded-md shadow-md px-4 py-3.5 animate-[fade-slide_.3s_var(--ease-out)]",
                    cfg.ring
                  )}
                >
                  <Icon size={19} className={cn("flex-none mt-0.5", cfg.iconCls)} />
                  <p className="text-[13.5px] text-ink flex-1 min-w-0 break-words leading-snug">{t.message}</p>
                  <button
                    onClick={() => remove(t.id)}
                    aria-label="Fechar"
                    className="text-ink-muted hover:text-ink transition-colors cursor-pointer flex-none"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

