import {
  LayoutDashboard,
  Sparkles,
  PenSquare,
  Lightbulb,
  Eye,
  Trophy,
  GraduationCap,
  Share2,
  Megaphone,
  BarChart3,
  CreditCard,
  User,
  Settings,
  Info,
  LogOut,
} from "lucide-react";

/**
 * Navegação oficial do app Inst Acessor (Etapa 1.6).
 * Itens estruturais — páginas ainda sem funcionalidade real.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
}

export const mainNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    description: "Visão geral do seu Instagram",
  },
  {
    label: "IA Acessor",
    href: "/app/ia-acessor",
    icon: Sparkles,
    description: "Sua mentoria com IA",
  },
  {
    label: "Gerador de Copy",
    href: "/app/gerador-de-copy",
    icon: PenSquare,
    description: "Legendas prontas em segundos",
  },
  {
    label: "Ideias",
    href: "/app/ideias",
    icon: Lightbulb,
    description: "Inspiração para conteúdos",
  },
  {
    label: "Preview Social",
    href: "/app/preview-social",
    icon: Eye,
    description: "Como seu perfil aparece",
  },
  {
    label: "Rank",
    href: "/app/rank",
    icon: Trophy,
    description: "Sua posição no ranking",
  },
  {
    label: "Mentoria",
    href: "/app/mentoria",
    icon: GraduationCap,
    description: "Acompanhamento personalizado",
  },
  {
    label: "Redes Sociais",
    href: "/app/redes-sociais",
    icon: Share2,
    description: "Conecte e gerencie suas contas",
  },
  {
    label: "Gerador de Anúncios",
    href: "/app/gerador-de-anuncios",
    icon: Megaphone,
    description: "Campanhas e anúncios",
  },
  {
    label: "Análise de Desempenho",
    href: "/app/analise-de-desempenho",
    icon: BarChart3,
    description: "Métricas e comparativos",
  },
];

export const bottomNav: NavItem[] = [
  {
    label: "Minha Assinatura",
    href: "/app/assinatura",
    icon: CreditCard,
    description: "Planos e cobrança",
  },
  {
    label: "Perfil",
    href: "/app/perfil",
    icon: User,
    description: "Seus dados e preferências",
  },
  {
    label: "Configurações",
    href: "/app/configuracoes",
    icon: Settings,
    description: "Preferências da conta",
  },
  {
    label: "Sobre o Inst Acessor",
    href: "/app/sobre",
    icon: Info,
    description: "Conheça o produto",
  },
];

export const signOutItem: NavItem = {
  label: "Sair",
  href: "/api/auth/signout",
  icon: LogOut,
  description: "Encerrar sessão",
};
