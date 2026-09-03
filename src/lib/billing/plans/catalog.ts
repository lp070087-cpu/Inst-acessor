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
 *   Anual    R$ 547,00  → 54700   (preço oficial desde 2026-08-31;
 *                                  o antigo R$ 497,00 NÃO é mais válido)
 *
 * Checkout oficial: InfinitePay (links públicos por plano — ver seção 3 do
 * RELATORIO-INFINITEPAY-PLANOS.md). Os links podem viver no frontend porque
 * são URLs públicas de pagamento; nenhuma chave/segredo da InfinitePay é
 * usada nesta tarefa.
 *
 * NENHUM id externo é inventado.
 */

export const PLAN_CATALOG = [
  {
    slug: "semanal",
    name: "Inst acessor Semanal",
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
    /** Link público do checkout InfinitePay do plano semanal. */
    checkoutUrl:
      "https://invoice.infinitepay.io/plans/unitrix/QxyWJ8UOq6",
  },
  {
    slug: "mensal",
    name: "Inst acessor mensal",
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
    /** Link público do checkout InfinitePay do plano mensal. */
    checkoutUrl:
      "https://invoice.infinitepay.io/plans/unitrix/gC8t6WTiVQ",
  },
  {
    slug: "anual",
    name: "Inst acessor Anual",
    priceCents: 54700,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "YEAR",
    durationDays: 365,
    description:
      "Assinatura anual. Equivalente aproximado de R$ 45,58/mês — a melhor relação custo-benefício.",
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
    /** Link público do checkout InfinitePay do plano anual. */
    checkoutUrl:
      "https://invoice.infinitepay.io/plans/unitrix/5LZNvhvbLY",
  },
] as const;

export type PlanSlug = (typeof PLAN_CATALOG)[number]["slug"];
