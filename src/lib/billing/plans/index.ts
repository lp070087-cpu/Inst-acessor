import { bll } from "@/lib/billing/db";
import { PLAN_CATALOG, type PlanSlug } from "./catalog";

/**
 * PLANOS — SERVIÇO (Fase 6.5)
 * ============================
 * Resolve planos para o servidor. O catálogo oficial imutável vive em
 * `./catalog` (fonte de verdade para preços/duração/ciclo).
 *
 * Regra oficial (escopo permanente): NÃO depender de seed/tabela de planos —
 * o catálogo em código/backend é a fonte de verdade. Por isso:
 *   - `listPlans()` garante que os planos do catálogo existam no banco
 *     (self-heal idempotente por slug) e, se o banco estiver indisponível,
 *     devolve o catálogo oficial diretamente — os cards SEMPRE aparecem.
 *   - `getPlanById()`/`getPlanBySlug()` têm o mesmo fallback em código.
 *   - Preços SEMPRE em centavos inteiros (nunca Float para dinheiro):
 *       Semanal  R$ 27,00   → 2700
 *       Mensal   R$ 77,00   → 7700
 *       Anual    R$ 547,00  → 54700   (oficial desde 2026-08-31)
 *
 * NENHUM id externo é inventado.
 */

export { PLAN_CATALOG, type PlanSlug } from "./catalog";

// Apresentação dos planos (valor formatado, periodicidade, nome curto) — módulo
// PURO, sem Prisma. Componentes de cliente importam de `@/lib/billing/plans/display`
// diretamente; aqui só reexportamos para os consumidores de servidor.
export {
  formatBRL,
  planBillingLabel,
  planLandingPeriod,
  planPeriodLabel,
  planPriceSuffix,
  planShortName,
  annualVsMonthly,
  LANDING_PLAN_FEATURES,
  type PlanShape,
} from "./display";

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
  // NOTE: nenhuma URL estática de pagamento por plano. O checkout Asaas é
  // criado no servidor por compra (POST /v3/checkouts) e devolvido em
  // `CreateCheckoutResult.checkoutUrl` — nunca no catálogo/plano.
}

/** ID determinístico de um plano do catálogo quando usado fora do banco. */
const CATALOG_ID_PREFIX = "plan:";

type CatalogPlan = (typeof PLAN_CATALOG)[number];

function toCatalogView(p: CatalogPlan): PlanView {
  return {
    id: `${CATALOG_ID_PREFIX}${p.slug}`,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    currency: p.currency,
    type: p.type,
    billingInterval: p.billingInterval,
    durationDays: p.durationDays,
    description: p.description,
    features: [...p.features] as string[],
    badge: p.badge,
    active: p.active,
    sortOrder: p.sortOrder,
  };
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

/**
 * Self-heal IDEMPOTENTE: garante que os 3 planos do catálogo oficial existam
 * no banco (criados por slug quando ausentes) e, quando já existem, sincroniza
 * nome/preço/duração/ciclo com o catálogo (fonte de verdade — ex.: preço anual
 * R$ 547,00 desde 2026-08-31). Mantém a FK de `Subscription` válida e faz com
 * que os cards sempre apareçam — sem depender de um seed manual.
 * NÃO altera assinaturas/pagamentos históricos (esses preservam `amountCents`).
 * Nenhuma URL de pagamento é persistida: o checkout Asaas é criado no servidor
 * por compra e nunca vive no catálogo/plano.
 */
async function ensureCatalogPlans(): Promise<void> {
  const rows = (await bll.plan.findMany({
    select: { slug: true },
  })) as unknown as { slug: string }[];
  const existing = new Set(rows.map((r) => r.slug));
  for (const p of PLAN_CATALOG) {
    // Apenas campos que existem no schema `Plan` (sem `checkoutUrl`).
    const data = {
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      type: p.type,
      billingInterval: p.billingInterval,
      durationDays: p.durationDays,
      description: p.description,
      features: [...p.features] as string[],
      badge: p.badge,
      active: p.active,
      sortOrder: p.sortOrder,
    };
    if (!existing.has(p.slug)) {
      await bll.plan.create({ data });
    } else {
      await bll.plan.updateMany({ where: { slug: p.slug }, data });
    }
  }
}

/**
 * Sobrepoõe os valores oficiais do catálogo em um plano vindo do banco.
 * Garante que nome/preço exibidos sejam SEMPRE os do catálogo (fonte de
 * verdade), mesmo se a linha no banco ainda tiver o valor antigo
 * (ex.: plano anual 49700 gravado antes da atualização para 54700).
 */
function withCatalogOverlay(view: PlanView): PlanView {
  const c = PLAN_CATALOG.find((p) => p.slug === view.slug);
  if (!c) return view;
  return {
    ...view,
    name: c.name,
    priceCents: c.priceCents,
    description: c.description ?? view.description,
    badge: c.badge ?? view.badge,
  };
}

/** Lista os planos ativos, ordenados. Fonte de verdade: catálogo oficial. */
export async function listPlans(): Promise<PlanView[]> {
  try {
    // Garante que o catálogo oficial exista no banco (sem depender de seed).
    await ensureCatalogPlans();
    const rows = (await bll.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })) as unknown as Parameters<typeof toPlanView>[0][];
    if (rows.length > 0) {
      return rows.map((r) => withCatalogOverlay(toPlanView(r)));
    }
  } catch {
    // Banco indisponível — fallback de exibição com o catálogo oficial.
  }
  return PLAN_CATALOG.filter((p) => p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toCatalogView);
}

/** Busca um plano por id (banco → fallback no catálogo oficial). */
export async function getPlanById(id: string): Promise<PlanView | null> {
  try {
    const row = (await bll.plan.findUnique({ where: { id } })) as unknown as
      | Parameters<typeof toPlanView>[0]
      | null;
    if (row) return withCatalogOverlay(toPlanView(row));
  } catch {
    // segue para o fallback do catálogo
  }
  const slug = id.startsWith(CATALOG_ID_PREFIX) ? id.slice(CATALOG_ID_PREFIX.length) : id;
  const catalogPlan = PLAN_CATALOG.find((p) => p.slug === slug);
  if (!catalogPlan) return null;
  try {
    // Se o id era de catálogo ("plan:<slug>") e o banco está disponível,
    // garante a linha existir — mantém a FK de `Subscription` válida no
    // checkout sem exigir seed manual.
    await ensureCatalogPlans();
    const row = (await bll.plan.findFirst({
      where: { slug },
    })) as unknown as Parameters<typeof toPlanView>[0] | null;
    if (row) return withCatalogOverlay(toPlanView(row));
  } catch {
    // banco indisponível — devolve a visão de exibição do catálogo
  }
  return toCatalogView(catalogPlan);
}

/** Busca um plano por slug (banco → fallback no catálogo oficial). */
export async function getPlanBySlug(slug: string): Promise<PlanView | null> {
  try {
    const row = (await bll.plan.findFirst({
      where: { slug },
    })) as unknown as Parameters<typeof toPlanView>[0] | null;
    if (row) return withCatalogOverlay(toPlanView(row));
  } catch {
    // segue para o fallback do catálogo
  }
  const catalogPlan = PLAN_CATALOG.find((p) => p.slug === slug);
  return catalogPlan ? toCatalogView(catalogPlan) : null;
}

/**
 * Popula o catálogo de planos de forma IDEMPOTENTE (por slug).
 * Mantido como utilitário explícito; o fluxo normal já se auto-corrige em
 * `listPlans()` (`ensureCatalogPlans`), sem depender de rodar este seed.
 */
export async function seedPlanCatalog(): Promise<void> {
  await ensureCatalogPlans();
}
