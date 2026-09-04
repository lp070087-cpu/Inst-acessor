"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Atraso da entrada em ms (para um leve stagger). */
  delay?: number;
}

/**
 * REVEAL — roda #292 (Sobre)
 * ==========================
 * Entrada premium e sutil ao rolar: fade + leve elevação (translateY),
 * sem biblioteca. Usa IntersectionObserver e respeita o usuário:
 *
 * - `prefers-reduced-motion: reduce` → exibe direto, SEM animação.
 * - Sem IntersectionObserver (UA antiga) → exibe direto.
 * - A duração usa a transição global do app (ease-out dos tokens).
 *
 * Não esconde conteúdo permanentemente: ao entrar na viewport, marca
 * `visible` e remove o observer (executa uma única vez).
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced-motion: mostra sem animação (acessibilidade em primeiro lugar).
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[var(--ease-out)] will-change-transform motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      {children}
    </div>
  );
}
