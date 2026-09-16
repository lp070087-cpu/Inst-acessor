"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronLeft, LogOut, X } from "lucide-react";
import type { Session } from "next-auth";

import { cn } from "@/lib/utils";
import { mainNav, bottomNav, adminNavItem } from "@/lib/navigation";
import { AppLogo } from "@/components/layout/app-logo";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";

const STORAGE_KEY = "inst-acessor:sidebar-collapsed";

export function AppSidebar({
  user,
  isAdmin = false,
  account,
}: {
  user: Session["user"];
  /** Autorizado como admin exclusivo (decidido no servidor). */
  isAdmin?: boolean;
  /**
   * Identidade REAL da conta, lida do banco pelo layout.
   *
   * Por que não usar `user.name`/`user.image` direto da sessão: a sessão é JWT,
   * então nome e foto são congelados no momento do login. Depois de editar o
   * perfil, a sidebar continuaria mostrando o valor antigo até o usuário sair e
   * entrar de novo. Estes campos vêm do banco a cada renderização.
   */
  account?: { name: string | null; avatar: string | null };
}) {
  // O banco manda; a sessão é só o fallback de compatibilidade.
  const displayName = account ? account.name : user?.name ?? null;
  const displayAvatar = account ? account.avatar : user?.image ?? null;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCollapsed(saved === "1");
    } catch {
      /* localStorage indisponível — segue com default */
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignora */
    }
  }, [collapsed]);

  // Fecha o drawer mobile ao navegar
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Trava o scroll do fundo enquanto o menu mobile está aberto e permite
  // fechar com Esc. Sem isso a página atrás continua rolando por baixo do
  // overlay — o menu ficava "preso sobre a página".
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <>
      {/* Barra superior mobile/tablet */}
      {/* BLOCO 5 — safe area: no iPhone com notch/Dynamic Island o `env()`
          devolve a altura da faixa, então `padding-top` cresce e o conteúdo
          sai de baixo do recorte. `max(0px, env(...))` mantém zero de padding
          em navegadores que NÃO têm safe area (o `env()` resolve para 0) —
          nada de faixa vazia no Android/desktop. O `h-16` virou `min-h-16`
          justamente para a caixa poder crescer. */}
      <header className="sticky top-0 z-40 flex items-center justify-between min-h-16 px-4 pt-[max(0px,env(safe-area-inset-top))] bg-bg-ice/80 backdrop-blur-md border-b border-border-soft lg:hidden">
        <Link href="/dashboard" aria-label="Inst Acessor — início">
          <AppLogo />
        </Link>
        <IconButton label="Abrir menu" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </IconButton>
      </header>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-card border-r border-border-soft transition-[width] duration-300 ease-out",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-border-soft flex-none">
          {!collapsed && <Link href="/dashboard"><AppLogo /></Link>}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "w-8 h-8 rounded-[10px] border border-border bg-bg-ice text-ink-soft hover:text-ink transition-all grid place-items-center cursor-pointer",
              collapsed && "mx-auto"
            )}
          >
            <ChevronLeft
              size={16}
              className={cn("transition-transform duration-300", collapsed && "rotate-180")}
            />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
          <div className="flex flex-col gap-0.5">
            {mainNav.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                active={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
          <div className="my-4 h-px bg-border-soft" />
          <div className="flex flex-col gap-0.5">
            {isAdmin && (
              <SidebarNavItem
                key={adminNavItem.href}
                item={adminNavItem}
                active={isActive(adminNavItem.href)}
                collapsed={collapsed}
              />
            )}
            {bottomNav.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                active={isActive(item.href)}
                collapsed={collapsed}
              />
            ))}
            <SidebarNavItem item={{ label: "Sair", href: "/login", icon: LogOut, description: "Encerrar sessão" }} collapsed={collapsed} isSignOut />
          </div>
        </nav>

        <div className="p-4 border-t border-border-soft flex-none">
          {collapsed ? (
            <div className="flex justify-center">
              <Avatar name={displayName} src={displayAvatar} size="sm" />
            </div>
          ) : (
            <Link
              href="/perfil"
              className="flex items-center gap-3 rounded-[12px] p-2 hover:bg-surface transition-colors"
            >
              <Avatar name={displayName} src={displayAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink truncate">
                  {displayName ?? "Minha conta"}
                </p>
                <p className="text-[11.5px] text-ink-muted truncate">
                  {user?.email}
                </p>
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* Overlay + drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          {/* BLOCO 5 — safe area também aqui: no iPhone o drawer encosta nas
              bordas superior e inferior da tela, e o último item do menu ("Sair")
              ficava sob a barra de gestos. `env()` é 0 nos outros navegadores. */}
          <aside className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-card border-r border-border-soft shadow-lg flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-[fade-slide_.3s_var(--ease-out)]">
            <div className="flex items-center justify-between h-16 px-5 border-b border-border-soft flex-none">
              <AppLogo />
              <IconButton label="Fechar menu" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </IconButton>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
              <div className="flex flex-col gap-0.5">
                {mainNav.map((item) => (
                  <SidebarNavItem key={item.href} item={item} active={isActive(item.href)} />
                ))}
              </div>
              <div className="my-4 h-px bg-border-soft" />
              <div className="flex flex-col gap-0.5">
                {isAdmin && (
                  <SidebarNavItem key={adminNavItem.href} item={adminNavItem} active={isActive(adminNavItem.href)} />
                )}
                {bottomNav.map((item) => (
                  <SidebarNavItem key={item.href} item={item} active={isActive(item.href)} />
                ))}
                <SidebarNavItem item={{ label: "Sair", href: "/login", icon: LogOut, description: "Encerrar sessão" }} isSignOut />
              </div>
            </nav>
            <div className="p-4 border-t border-border-soft flex-none flex items-center gap-3 min-w-0">
              <Avatar name={displayName} src={displayAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                {/* BLOCO 5 — e-mail longo: `truncate` já corta com reticências,
                    mas sem `min-w-0 flex-1` na coluna o texto longo empurrava a
                    largura do drawer em vez de encolher. */}
                <p className="text-[13.5px] font-semibold text-ink truncate">
                  {displayName ?? "Minha conta"}
                </p>
                <p className="text-[11.5px] text-ink-muted truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
