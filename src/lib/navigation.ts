import {
  LayoutDashboard,
  Sparkles,
  PenSquare,
  Lightbulb,
  Eye,
  Trophy,
  GraduationCap,
  BrainCircuit,
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
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Visão geral do seu Instagram",
  },
  {
    label: "IA Acessor",
    href: "/ia-acessor",
    icon: Sparkles,
    description: "Sua mentoria com IA",
  },
  {
    label: "Gerador de Copy",
    href: "/gerador-de-copy",
    icon: PenSquare,
    description: "Legendas prontas em segundos",
  },
  {
    label: "Ideias",
    href: "/ideias",
    icon: Lightbulb,
    description: "Inspiração para conteúdos",
  },
  {
    label: "Preview Social",
    href: "/preview-social",
    icon: Eye,
    description: "Como seu perfil aparece",
  },
  {
    label: "Rank",
    href: "/rank",
    icon: Trophy,
    description: "Sua posição no ranking",
  },
  {
    label: "Mentoria",
    href: "/mentoria",
    icon: GraduationCap,
    description: "Acompanhamento personalizado",
  },
  {
    label: "Score Inteligente",
    href: "/score",
    icon: BrainCircuit,
    description: "Seu score 0–100 com diagnóstico",
  },
  {
    label: "Perfil de Inteligência",
    href: "/perfil-de-inteligencia",
    icon: BrainCircuit,
    description: "O que a IA aprendeu sobre você",
  },
  {
    label: "Redes Sociais",
    href: "/redes-sociais",
    icon: Share2,
    description: "Conecte e gerencie suas contas",
  },
  {
    label: "Gerador de Anúncios",
    href: "/gerador-de-anuncios",
    icon: Megaphone,
    description: "Campanhas e anúncios",
  },
  {
    label: "Análise de Desempenho",
    href: "/analise-de-desempenho",
    icon: BarChart3,
    description: "Métricas e comparativos",
  },
];

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

export const signOutItem: NavItem = {
  label: "Sair",
  href: "/api/auth/signout",
  icon: LogOut,
  description: "Encerrar sessão",
};
