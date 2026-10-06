"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * ABAS DE MÓDULO
 * ==============
 * Duas telas que são a MESMA família de trabalho passam a viver sob um módulo
 * só, trocadas por abas — em vez de ocuparem dois itens cada no menu lateral.
 *
 * Calendário          → Calendário | Calendário Inteligente
 * Perfil de Inteligência → Perfil de Inteligência | Score Inteligente
 *
 * São LINKS de verdade (`<Link>`), não estado de cliente: cada aba tem a sua
 * rota, então funcionam o botão voltar, o recarregar e o link direto. Também
 * mantém cada página como Server Component, carregando só os dados que ela usa.
 */
export interface ModuleTab {
  href: string;
  label: string;
}

export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções deste módulo"
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto bg-surface border border-border-soft rounded-pill p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-pill px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all",
              active
                ? "bg-card text-ink shadow-xs"
                : "text-ink-soft hover:text-ink"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Conjuntos de abas por módulo — fonte única, usada pelas quatro páginas. */
export const CALENDAR_MODULE_TABS: ModuleTab[] = [
  { href: "/calendario", label: "Calendário" },
  { href: "/calendario-inteligente", label: "Calendário Inteligente" },
];

export const INTELLIGENCE_MODULE_TABS: ModuleTab[] = [
  { href: "/perfil-de-inteligencia", label: "Perfil de Inteligência" },
  { href: "/score", label: "Score Inteligente" },
];
