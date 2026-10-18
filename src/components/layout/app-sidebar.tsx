"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronLeft, ChevronDown, LogOut, X } from "lucide-react";
import type { Session } from "next-auth";

import { cn } from "@/lib/utils";
import {
  navGroups,
  isPremiumRoute,
  isNavItemActive,
  type NavGroup,
} from "@/lib/navigation";
import { AppLogo } from "@/components/layout/app-logo";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/** Largura recolhida/expandida da sidebar (rail x full). */
const STORAGE_KEY = "inst-acessor:sidebar-collapsed";
/**
 * Grupos expandidos/recolhidos. Chave PRÓPRIA (não reusa a da largura): são
 * preferências independentes — recolher a barra não deve fechar os grupos.
 */
const GROUPS_KEY = "inst-acessor:sidebar-groups";

/**
 * Um grupo do menu. Na sidebar expandida vira um cabeçalho-botão colapsável;
 * no modo rail (`collapsed`) some o cabeçalho e ficam só os ícones, para a
 * coluna de 80px não quebrar.
 *
 * Acessibilidade: o cabeçalho é um <button> de verdade (operável por teclado),
 * com `aria-expanded` e `aria-controls` apontando para o painel, que recebe
 * `id` e o atributo `hidden` quando fechado.
 */
function NavGroupSection({
  group,
  panelId,
  open,
  onToggle,
  isActive,
  hasPremiumAccess,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  panelId: string;
  open: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  hasPremiumAccess: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  // Modo rail: apenas ícones, sem cabeçalho colapsável (o divisor entre grupos
  // é desenhado pelo pai).
  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed
            locked={!hasPremiumAccess && isPremiumRoute(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  const GroupIcon = group.icon;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
      >
        <GroupIcon size={15} strokeWidth={2} className="flex-none" />
        <span className="truncate">{group.label}</span>
        <ChevronDown
          size={14}
          className={cn(
            "flex-none ml-auto transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>
      {/* O wrapper NÃO tem classe de display: o atributo `hidden` (stylesheet do
          agente) só funciona se nada com especificidade de classe sobrescrever
          `display` — por isso o `flex` fica no filho. */}
      <div id={panelId} hidden={!open}>
        <div className="flex flex-col gap-0.5 pl-1 pt-0.5">
          {group.items.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              locked={!hasPremiumAccess && isPremiumRoute(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({
  user,
  isAdmin = false,
  hasPremiumAccess = false,
  account,
}: {
  user: Session["user"];
  /** Autorizado como admin exclusivo (decidido no servidor). */
  isAdmin?: boolean;
  /**
   * O usuário tem direito de acesso ao plano? Decidido NO SERVIDOR
   * (`resolvePremiumAccess`) e apenas EXIBIDO aqui: com `false`, os módulos do
   * plano aparecem com cadeado. O menu nunca é a autoridade — quem bloqueia a
   * rota é o layout.
   */
  hasPremiumAccess?: boolean;
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
  const drawerRef = React.useRef<HTMLElement>(null);
  useDialogFocus(mobileOpen, drawerRef, () => setMobileOpen(false));
  const [collapsed, setCollapsed] = React.useState(false);
  // id do grupo -> expandido? Ausência = "usar o padrão" (ativo abre, resto fecha).
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
  const [groupsLoaded, setGroupsLoaded] = React.useState(false);

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

  // Publica a largura da barra no <html> para o conteúdo acompanhar o rail.
  // O <html> é o único ancestral comum entre a sidebar (fixed) e o <main>.
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-sidebar-w", collapsed ? "5rem" : "18rem");
  }, [collapsed]);

  // Preferência de grupos colapsados.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setOpenGroups(parsed);
      }
    } catch {
      /* JSON corrompido — segue com default */
    }
    setGroupsLoaded(true);
  }, []);

  // Só grava DEPOIS de ler: sem o guarda, o estado inicial `{}` sobrescreveria
  // o que estava salvo antes da leitura terminar.
  React.useEffect(() => {
    if (!groupsLoaded) return;
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignora */
    }
  }, [openGroups, groupsLoaded]);

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

  // Grupos visíveis: o de administração só entra quando o servidor autoriza.
  const visibleGroups = React.useMemo(
    () => navGroups.filter((group) => !group.adminOnly || isAdmin),
    [isAdmin]
  );

  // "Ativo" passa pelo helper de `navigation.ts` para respeitar a exclusão
  // pai/filho: `/calendario-inteligente` também começa com `/calendario`, e o
  // teste por prefixo acendia o pai E o filho ao mesmo tempo. O filho tem
  // precedência.
  const isActive = (href: string) => {
    const item = visibleGroups.flatMap((group) => group.items).find((i) => i.href === href);
    return item ? isNavItemActive(pathname, item) : pathname.startsWith(href);
  };

  // Grupo que contém a rota atual — ele NUNCA pode ficar fechado.
  const activeGroupId = React.useMemo(() => {
    for (const group of visibleGroups) {
      if (group.items.some((item) => isNavItemActive(pathname, item))) {
        return group.id;
      }
    }
    return null;
  }, [visibleGroups, pathname]);

  // Padrão: o grupo ativo abre, os outros fecham. Preferência salva do usuário
  // tem prioridade — exceto para o grupo ativo, que é forçado aberto.
  const isGroupOpen = (id: string) =>
    id === activeGroupId ? true : openGroups[id] ?? false;

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? (id === activeGroupId)),
    }));
  };

  const signOutNavItem = {
    label: "Sair",
    href: "/login",
    icon: LogOut,
    description: "Encerrar sessão",
  };

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

      {/* Sidebar desktop.
          A largura atual é publicada em `--app-sidebar-w` no <html> (via efeito),
          e o layout usa `lg:pl-[var(--app-sidebar-w,18rem)]`. Assim o conteúdo
          acompanha o rail de ícones: antes o offset era `lg:pl-72` fixo e sobrava
          um vão morto de ~208px ao recolher. A var precisa morar num ancestral
          comum (o <html>) porque <main> é IRMÃO da sidebar — var não atravessa. */}
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
          <div className="flex flex-col gap-1">
            {visibleGroups.map((group, index) => (<React.Fragment key={group.id}>{index > 0 && <div className="my-2 h-px bg-border-soft" />}{group.items.map((item) => (<SidebarNavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} locked={!hasPremiumAccess && isPremiumRoute(item.href)} />))}</React.Fragment>))}
          </div>
          <div className="my-4 h-px bg-border-soft" />
          <div className="flex flex-col gap-0.5">
            <SidebarNavItem item={signOutNavItem} collapsed={collapsed} isSignOut />
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
          <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu de navegação" tabIndex={-1} className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-card border-r border-border-soft shadow-lg flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-[fade-slide_.3s_var(--ease-out)]">
            <div className="flex items-center justify-between h-16 px-5 border-b border-border-soft flex-none">
              <AppLogo />
              <IconButton label="Fechar menu" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </IconButton>
            </div>
            {/* Mesmo agrupamento e mesmo estado de colapso do desktop — em tela
                pequena, enxugar a lista ajuda ainda mais. */}
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
              <div className="flex flex-col gap-1">
                {visibleGroups.map((group) => (
                  <NavGroupSection
                    key={group.id}
                    group={group}
                    panelId={`mobile-group-${group.id}`}
                    open={isGroupOpen(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    isActive={isActive}
                    hasPremiumAccess={hasPremiumAccess}
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
              <div className="my-4 h-px bg-border-soft" />
              <div className="flex flex-col gap-0.5">
                <SidebarNavItem item={signOutNavItem} isSignOut />
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
