/**
 * PLANOS — CATÁLOGO OFICIAL (imutável, puro)
 * ============================================
 * Fonte de verdade do catálogo de planos. Módulo SEM dependências de banco
 * para permitir testes determinísticos (`npm run billing:test`) sem instanciar
 * o Prisma client.
 *
 * Os 3 planos do Inst Acessor. Todos liberam INSTAGRAM + TIKTOK.
 * NÃO existe plano "Combo".
 *
 * Preços SEMPRE em centavos inteiros (nunca Float para dinheiro):
 *   Semanal  R$ 27,00   → 2700
 *   Mensal   R$ 77,00   → 7700
 *   Anual    R$ 497,00  → 49700
 *
 * NENHUM id externo é inventado.
 */

export const PLAN_CATALOG = [
  {
    slug: "semanal",
    name: "Semanal",
    priceCents: 2700,
    currency: "BRL",
    type: "ONE_TIME",
    billingInterval: null,
    durationDays: 7,
    description:
      "Acesso por 7 dias. Pagamento único, sem renovação automática.",
    features: [
      "Instagram",
      "TikTok",
      "Dashboard",
      "IA Acessor",
      "Cérebro Estratégico",
      "Diagnóstico",
      "Score",
      "Ideias",
      "Copy",
      "Preview Social",
      "Calendário",
      "Planejamento",
      "Mentoria",
      "Rank",
      "XP",
      "Metas",
      "Conquistas",
    ],
    badge: null,
    active: true,
    sortOrder: 1,
  },
  {
    slug: "mensal",
    name: "Mensal",
    priceCents: 7700,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description:
      "Assinatura mensal recorrente. Acesso contínuo enquanto estiver ativa.",
    features: [
      "Instagram",
      "TikTok",
      "Dashboard",
      "IA Acessor",
      "Cérebro Estratégico",
      "Diagnóstico",
      "Score",
      "Ideias",
      "Copy",
      "Preview Social",
      "Calendário",
      "Planejamento",
      "Mentoria",
      "Rank",
      "XP",
      "Metas",
      "Conquistas",
    ],
    badge: "MAIS_ESCOLHIDO",
    active: true,
    sortOrder: 2,
  },
  {
    slug: "anual",
    name: "Anual",
    priceCents: 49700,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "YEAR",
    durationDays: 365,
    description:
      "Assinatura anual. Equivalente aproximado de R$ 41,42/mês — a melhor relação custo-benefício.",
    features: [
      "Instagram",
      "TikTok",
      "Dashboard",
      "IA Acessor",
      "Cérebro Estratégico",
      "Diagnóstico",
      "Score",
      "Ideias",
      "Copy",
      "Preview Social",
      "Calendário",
      "Planejamento",
      "Mentoria",
      "Rank",
      "XP",
      "Metas",
      "Conquistas",
    ],
    badge: "MELHOR_CUSTO_BENEFICIO",
    active: true,
    sortOrder: 3,
  },
] as const;

export type PlanSlug = (typeof PLAN_CATALOG)[number]["slug"];
