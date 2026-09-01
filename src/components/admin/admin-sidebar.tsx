"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CreditCard, Plug, Cpu, Webhook, Menu, X, ShieldCheck } from "lucide-react";
import type { Session } from "next-auth";

import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/layout/app-logo";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";

interface AdminNavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
}

const adminNav: AdminNavItem[] = [
  {
    label: "Visão Geral",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Métricas reais do sistema",
  },
  {
    label: "Usuários",
    href: "/admin/usuarios",
    icon: Users,
    description: "Contas, papéis e status",
  },
  {
    label: "Assinaturas",
    href: "/admin/assinaturas",
    icon: CreditCard,
    description: "Planos e pagamentos",
  },
  {
    label: "Integrações",
    href: "/admin/integracoes",
    icon: Plug,
    description: "Status das conexões",
  },
  {
    label: "IA Acessor",
    href: "/admin/ia",
    icon: Cpu,
    description: "Configuração central da IA",
  },
  {
    label: "Webhooks",
    href: "/admin/webhooks",
    icon: Webhook,
    description: "Status dos endpoints de notificação",
  },
];

export function AdminSidebar({ user }: { user: Session["user"] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu administrativo">
      <p className="px-3 mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        Administração
      </p>
      <div className="flex flex-col gap-0.5">
        {adminNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-all duration-200 cursor-pointer",
                active ? "bg-ai-soft" : "hover:bg-surface"
              )}
            >
              <Icon
                size={19}
                strokeWidth={2}
                className={cn("flex-none", active ? "text-purple" : "text-ink-soft")}
              />
              <span
                className={cn(
                  "text-[13.5px] truncate",
                  active ? "text-ink font-semibold" : "text-ink-soft"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="my-4 h-px bg-border-soft" />
      <div className="flex flex-col gap-0.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-all duration-200 cursor-pointer hover:bg-surface"
        >
          <ShieldCheck size={19} strokeWidth={2} className="flex-none text-ink-soft" />
          <span className="text-[13.5px] text-ink-soft truncate">Voltar ao app</span>
        </Link>
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-all duration-200 cursor-pointer hover:bg-danger-softMid"
        >
          <ShieldCheck size={19} strokeWidth={2} className="flex-none text-danger" />
          <span className="text-[13.5px] text-danger truncate">Sair</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Barra superior mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 bg-bg-ice/80 backdrop-blur-md border-b border-border-soft lg:hidden">
        <Link href="/admin" aria-label="Inst Acessor — administração">
          <AppLogo />
        </Link>
        <IconButton label="Abrir menu admin" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </IconButton>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border-soft">
        <div className="flex items-center justify-between h-16 px-5 border-b border-border-soft flex-none">
          <Link href="/admin">
            <AppLogo />
          </Link>
        </div>
        {nav}
        <div className="p-4 border-t border-border-soft flex-none flex items-center gap-3">
          <Avatar name={user?.name} src={user?.image} size="sm" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">
              {user?.name ?? "Admin"}
            </p>
            <p className="text-[11.5px] text-ink-muted truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-card border-r border-border-soft shadow-lg flex flex-col animate-[fade-slide_.3s_var(--ease-out)]">
            <div className="flex items-center justify-between h-16 px-5 border-b border-border-soft flex-none">
              <AppLogo />
              <IconButton label="Fechar menu" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </IconButton>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
