import {
  LayoutDashboard,
  Sparkles,
  Lightbulb,
  Eye,
  Trophy,
  GraduationCap,
  BrainCircuit,
  Share2,
  Send,
  MessageSquareHeart,
  BarChart3,
  CalendarDays,
  CreditCard,
  User,
  Settings,
  Info,
  Images,
  LogOut,
  ShieldCheck,
} from "lucide-react";

/**
 * Navegação oficial do app Inst Acessor (Etapa 1.6).
 *
 * O menu principal é organizado em GRUPOS colapsáveis (`navGroups`), não em
 * uma lista plana: com 13 itens o antigo `mainNav` obrigava a rolar a sidebar
 * inteira para achar qualquer coisa. Cada grupo tem rótulo, ícone próprio e
 * pode ser expandido/recolhido; o item ativo força o grupo dele aberto.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
}

/**
 * Um grupo do menu: cabeçalho colapsável + os itens que ele contém.
 * `adminOnly` marca o grupo de administração, renderizado apenas quando o
 * servidor diz que o usuário é o admin exclusivo.
 */
export interface NavGroup {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
  adminOnly?: boolean;
}

export const bottomNav: NavItem[] = [
  {
    label: "Minha Assinatura",
    href: "/assinatura",
    icon: CreditCard,
    description: "Planos e cobrança",
  },
  {
    label: "Perfil",
    href: "/perfil",
    icon: User,
    description: "Seus dados e preferências",
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    description: "Preferências da conta",
  },
  {
    label: "Sobre o Inst Acessor",
    href: "/sobre",
    icon: Info,
    description: "Conheça o produto",
  },
];

/**
 * Item de navegação da área administrativa — renderizado CONDICIONALMENTE
 * apenas para o admin exclusivo (`isOfficialAdminEmail`), decidido no servidor
 * em `src/app/(app)/layout.tsx` e passado como prop ao `AppSidebar`.
 *
 * Nunca é exibido para clientes comuns: o `AppSidebar` só renderiza o grupo
 * "Administração" quando `isAdmin === true`, e o servidor redireciona quem não é
 * admin caso tente acessar `/admin` diretamente.
 */
export const adminNavItem: NavItem = {
  label: "Admin",
  href: "/admin",
  icon: ShieldCheck,
  description: "Painel administrativo (exclusivo)",
};

export const signOutItem: NavItem = {
  label: "Sair",
  href: "/api/auth/signout",
  icon: LogOut,
  description: "Encerrar sessão",
};

/**
 * Estrutura final do menu, em SEIS grupos:
 *
 *  1. Visão geral  — onde o usuário aterrissa
 *  2. Inteligência — a IA e o que ela aprende sobre a conta
 *  3. Conteúdo     — criar, guardar, planejar e publicar
 *  4. Resultados e relacionamento — medir e responder
 *  5. Conta        — assinatura, perfil, preferências e sobre
 *  6. Administração — exclusivo do admin (fora dos grupos normais)
 */
export const navGroups: NavGroup[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    icon: LayoutDashboard,
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Visão geral do seu Instagram",
      },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    icon: BrainCircuit,
    items: [
      {
        label: "IA Acessor",
        href: "/ia-acessor",
        icon: Sparkles,
        description: "Sua mentoria com IA",
      },
      {
        label: "Ideias",
        href: "/ideias",
        icon: Lightbulb,
        description: "Inspiração para conteúdos",
      },
      {
        label: "Mentoria",
        href: "/mentoria",
        icon: GraduationCap,
        description: "Acompanhamento personalizado",
      },
      {
        // Score Inteligente idem: é aba dentro desta tela, não item próprio.
        label: "Perfil de Inteligência",
        href: "/perfil-de-inteligencia",
        icon: BrainCircuit,
        description: "O que a IA aprendeu sobre você",
      },
      {
        label: "Rank",
        href: "/rank",
        icon: Trophy,
        description: "Sua posição no ranking",
      },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    icon: Send,
    items: [
      {
        // "Gerador de Copy" foi incorporado aqui: gerar, editar, visualizar e
        // salvar acontecem na mesma tela. O módulo deixou de ser um item próprio
        // da navegação, não de existir.
        label: "Preview Social",
        href: "/preview-social",
        icon: Eye,
        description: "Crie, visualize e salve seus posts",
      },
      {
        // Biblioteca de Mídia fica entre "Preview Social" (onde o conteúdo nasce)
        // e "Calendário" (onde ele é agendado) — é ali que o arquivo é escolhido.
        label: "Biblioteca de Mídia",
        href: "/biblioteca-de-midia",
        icon: Images,
        description: "Suas fotos e vídeos, prontos para reutilizar",
      },
      {
        // Calendário Inteligente NÃO é item de menu: ele vive DENTRO desta tela,
        // como aba. Um item de menu por variante inchava a lista sem acrescentar
        // caminho novo — a rota continua existindo e continua alcançável.
        label: "Calendário",
        href: "/calendario",
        icon: CalendarDays,
        description: "Planeje e organize suas publicações",
      },
      {
        // Central de Publicação: fila, histórico e os 6 estados já existiam em
        // /publishing, mas a rota estava fora da sidebar.
        label: "Publicação",
        href: "/publishing",
        icon: Send,
        description: "Publique e acompanhe seus conteúdos",
      },
    ],
  },
  {
    id: "resultados",
    label: "Resultados e relacionamento",
    icon: BarChart3,
    items: [
      {
        label: "Análise de Desempenho",
        href: "/analise-de-desempenho",
        icon: BarChart3,
        description: "Métricas e comparativos",
      },
      {
        label: "Respostas Inteligentes",
        href: "/respostas-inteligentes",
        icon: MessageSquareHeart,
        description: "Responda comentários com IA",
      },
      {
        label: "Redes Sociais",
        href: "/redes-sociais",
        icon: Share2,
        description: "Conecte e gerencie suas contas",
      },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    icon: User,
    items: bottomNav,
  },
  {
    id: "administracao",
    label: "Administração",
    icon: ShieldCheck,
    items: [adminNavItem],
    adminOnly: true,
  },
];

/**
 * Lista PLANA dos grupos do meio (1–4), mantida para compatibilidade: nada
 * fora da sidebar deveria depender da ordem do menu, mas a exportação continua
 * existindo e reflete exatamente os itens desses quatro grupos.
 */
const MAIN_GROUP_IDS = ["visao-geral", "inteligencia", "conteudo", "resultados"];

export const mainNav: NavItem[] = navGroups
  .filter((group) => MAIN_GROUP_IDS.includes(group.id))
  .flatMap((group) => group.items);

/**
 * MÓDULOS DO PLANO — exigem acesso premium (grant válido, assinatura ativa ou
 * ADMIN). A lista mora AQUI, e não em `@/lib/access/premium`, porque este
 * módulo é consumido por componentes CLIENT (a sidebar): importar o resolvedor
 * de acesso traria o Prisma para o bundle do navegador.
 *
 * O que fica de fora (acessível a conta sem plano): /dashboard,
 * /redes-sociais, /assinatura, /perfil, /configuracoes e /sobre.
 */
export const PREMIUM_ROUTES = [
  "/ia-acessor",
  "/ideias",
  "/calendario-inteligente",
  "/calendario",
  "/mentoria",
  "/score",
  "/perfil-de-inteligencia",
  "/publishing",
  "/biblioteca-de-midia",
  "/respostas-inteligentes",
  "/analise-de-desempenho",
] as const;

/** true se a rota exige plano. Fonte única usada pelo servidor e pela sidebar. */
export function isPremiumRoute(href: string): boolean {
  return PREMIUM_ROUTES.some((route) => href.startsWith(route));
}

/**
 * Um item deve aparecer como ATIVO nesta rota?
 *
 * A regra simples de prefixo (`pathname.startsWith(href)`) quebra quando um
 * grupo contém um filho cujo caminho COMEÇA com o do pai: em
 * `/calendario-inteligente`, o pai `/calendario` também casa por prefixo e os
 * dois acendem juntos. Um item com filhos só fica ativo quando NENHUM filho
 * casa — o filho tem precedência.
 *
 * `/dashboard` continua exigindo igualdade exata: toda rota do app começa com
 * `/`, e por prefixo o Dashboard nunca se apagaria.
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const isPath = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return item.href === "/dashboard" ? pathname === "/dashboard" : isPath(item.href);
}
