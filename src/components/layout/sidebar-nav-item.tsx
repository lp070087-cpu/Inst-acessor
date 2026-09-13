"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

interface SidebarNavItemProps {
  item: NavItem;
  active?: boolean;
  collapsed?: boolean;
  isSignOut?: boolean;
}

export function SidebarNavItem({
  item,
  active,
  collapsed,
  isSignOut,
}: SidebarNavItemProps) {
  const Icon = item.icon;

  const content = (
    <>
      <Icon
        size={19}
        strokeWidth={2}
        className={cn(
          "flex-none transition-colors",
          active ? "text-purple" : isSignOut ? "text-danger" : "text-ink-soft"
        )}
      />
      {!collapsed && (
        <span
          className={cn(
            "text-[13.5px] font-medium transition-colors truncate",
            active ? "text-ink font-semibold" : isSignOut ? "text-danger" : "text-ink-soft"
          )}
        >
          {item.label}
        </span>
      )}
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-all duration-200 cursor-pointer",
    active
      ? "bg-ai-soft"
      : isSignOut
        ? "text-danger hover:bg-danger-softMid"
        : "hover:bg-surface",
    collapsed && "justify-center px-0"
  );

  if (isSignOut) {
    // LOGOUT — o `Link` para `/api/auth/signout` estava errado em dois pontos:
    //   1. `GET /api/auth/signout` do NextAuth responde com a PÁGINA HTML de
    //      confirmação (na v4 um formulário com CSRF), então clicar em "Sair"
    //      levava a uma tela de confirmação em vez de encerrar a sessão;
    //   2. sem `callbackUrl`, a tela não tinha para onde voltar.
    // A forma correta é `signOut()` do next-auth/react, que faz o POST com o
    // CSRF token, invalida o cookie de sessão e devolve o usuário ao /login.
    // Reutiliza o NextAuth existente — nenhuma autenticação foi recriada.
    return (
      <button
        type="button"
        onClick={() => {
          void signOut({ callbackUrl: "/login" });
        }}
        className={cn("w-full text-left", className)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}
