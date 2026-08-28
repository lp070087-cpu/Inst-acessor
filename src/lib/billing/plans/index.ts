import { bll } from "@/lib/billing/db";

/**
 * CATÁLOGO OFICIAL DE PLANOS — Fase 6.5
 * ======================================
 * Os 3 planos do Inst Acessor. Todos liberam INSTAGRAM + TIKTOK.
 * NÃO existe plano "Combo".
 *
 * Preços SEMPRE em centavos inteiros (nunca Float para dinheiro):
 *   Semanal  R$ 27,00   → 2700
 *   Mensal   R$ 77,00   → 7700
 *   Anual    R$ 497,00  → 49700
 *
 * A fonte de verdade para exibição é o banco (Plan). Este módulo é o
 * seed/catálogo padrão usado para popular a tabela `Plan` de forma idempotente
 * (por slug). NENHUM id externo é inventado.
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

/** Dados de exibição/negócio de um plano (independentes do banco). */
export interface PlanView {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  type: string;
  billingInterval: string | null;
  durationDays: number | null;
  description: string | null;
  features: string[];
  badge: string | null;
  active: boolean;
  sortOrder: number;
}

function toPlanView(row: {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  type: string;
  billingInterval: string | null;
  durationDays: number | null;
  description: string | null;
  features: string[];
  badge: string | null;
  active: boolean;
  sortOrder: number;
}): PlanView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceCents: row.priceCents,
    currency: row.currency,
    type: row.type,
    billingInterval: row.billingInterval,
    durationDays: row.durationDays,
    description: row.description,
    features: row.features,
    badge: row.badge,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

/** Lista os planos ativos, ordenados. */
export async function listPlans(): Promise<PlanView[]> {
  const rows = (await bll.plan.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })) as unknown as Parameters<typeof toPlanView>[0][];
  return rows.map(toPlanView);
}

/** Busca um plano por id. */
export async function getPlanById(id: string): Promise<PlanView | null> {
  const row = (await bll.plan.findUnique({ where: { id } })) as unknown as
    | Parameters<typeof toPlanView>[0]
    | null;
  return row ? toPlanView(row) : null;
}

/** Busca um plano por slug. */
export async function getPlanBySlug(slug: string): Promise<PlanView | null> {
  const row = (await bll.plan.findFirst({
    where: { slug },
  })) as unknown as Parameters<typeof toPlanView>[0] | null;
  return row ? toPlanView(row) : null;
}

/**
 * Popula o catálogo de planos de forma IDEMPOTENTE (por slug).
 * Este seed NÃO é executado nesta fase (regra: sem seed) — fica disponível
 * como utilitário para a DONA rodar localmente quando autorizar.
 */
export async function seedPlanCatalog(): Promise<void> {
  for (const plan of PLAN_CATALOG) {
    const existing = await bll.plan.findFirst({ where: { slug: plan.slug } });
    if (existing) continue;
    await bll.plan.create({
      data: {
        ...plan,
        features: [...plan.features] as string[],
      },
    });
  }
}
