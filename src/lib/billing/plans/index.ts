import { bll } from "@/lib/billing/db";
import { PLAN_CATALOG, type PlanSlug } from "./catalog";

/**
 * PLANOS — SERVIÇO (Fase 6.5)
 * ============================
 * Resolve planos para o servidor. O catálogo oficial imutável vive em
 * `./catalog` (fonte de verdade para preços/duração/ciclo). Este módulo usa o
 * banco (`Plan`) como fonte de exibição e o catálogo como seed padrão.
 *
 * Preços SEMPRE em centavos inteiros (nunca Float para dinheiro):
 *   Semanal  R$ 27,00   → 2700
 *   Mensal   R$ 77,00   → 7700
 *   Anual    R$ 497,00  → 49700
 *
 * NENHUM id externo é inventado.
 */

export { PLAN_CATALOG, type PlanSlug } from "./catalog";

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
