import { settings } from "@/lib/admin/settings-db";
import { bll } from "@/lib/billing/db";
import {
  PLAN_CATALOG,
  applyActiveOverrides,
  effectiveActive,
  isLegacyPlan,
} from "@/lib/billing/plans/catalog";

/**
 * ATIVAÇÃO COMERCIAL DOS PLANOS — PERSISTÊNCIA
 * ============================================
 * O liga/desliga de venda de cada plano é uma decisão COMERCIAL do proprietário.
 * Ele sobrevive a deploy e ao self-heal do catálogo porque é gravado numa key
 * própria de `SystemSetting` (`billing.plan-active.v1`) E espelhado na coluna
 * real `Plan.active` — que é o que o CHECKOUT consulta (`/api/billing/checkout`
 * recusa plano com `active=false`) e o que `listPlans()` filtra.
 *
 * DUAS CAMADAS, UMA VERDADE:
 *   1. `SystemSetting` (override) — a fonte de verdade que o self-heal RESPEITA.
 *   2. `Plan.active` (banco)     — o que o checkout e a listagem pública leem.
 *
 * Por que as duas: gravar só na coluna seria desfeito na próxima chamada de
 * `listPlans()` (o self-heal reescreve a linha a partir do catálogo); gravar só
 * no SystemSetting não chegaria ao checkout, que lê a coluna. A função
 * `applyPlanActivation` grava as duas e garante que concordem.
 *
 * NUNCA mexe no catálogo em código (o `active:` versionado é só o padrão inicial).
 */

/** Chave única em `SystemSetting` onde vive o override de ativação por slug. */
export const PLANS_ACTIVE_SETTING_KEY = "billing.plan-active.v1";

/** Conjunto de slugs válidos do catálogo. */
const CATALOG_SLUGS: ReadonlySet<string> = new Set(PLAN_CATALOG.map((p) => p.slug));

/**
 * Normaliza um payload cru em overrides `slug → boolean`.
 * Slug fora do catálogo é descartado; valor que não é booleano é descartado.
 */
export function parseActiveOverrides(raw: unknown): Record<string, boolean> {
  if (typeof raw === "string") {
    try {
      return parseActiveOverrides(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const slug of Object.keys(o)) {
    if (!CATALOG_SLUGS.has(slug)) continue;
    const v = o[slug];
    if (typeof v === "boolean") out[slug] = v;
  }
  return out;
}

/** Lê os overrides gravados. Nunca lança; devolve `{}` (padrão do catálogo). */
export async function readActiveOverrides(): Promise<Record<string, boolean>> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: PLANS_ACTIVE_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return {};
    return parseActiveOverrides(row.value);
  } catch {
    return {};
  }
}

/** Lê os overrides E os aplica ao registro em memória deste processo. */
export async function loadActiveOverrides(): Promise<Record<string, boolean>> {
  const overrides = await readActiveOverrides();
  applyActiveOverrides(overrides);
  return overrides;
}

/** Grava os overrides (admin). Devolve o mapa normalizado que ficou salvo. */
export async function saveActiveOverrides(
  raw: unknown
): Promise<Record<string, boolean>> {
  const normalized = parseActiveOverrides(raw);
  const value = JSON.stringify(normalized);
  await settings.systemSetting.upsert({
    where: { key: PLANS_ACTIVE_SETTING_KEY },
    create: { key: PLANS_ACTIVE_SETTING_KEY, value },
    update: { value },
  });
  applyActiveOverrides(normalized);
  return normalized;
}

/**
 * Estado EFETIVO de ativação de cada slug (override → catálogo). É a visão que o
 * painel admin mostra e a que o self-heal consulta.
 */
export async function effectiveActivation(): Promise<Record<string, boolean>> {
  const overrides = await loadActiveOverrides();
  const out: Record<string, boolean> = {};
  for (const p of PLAN_CATALOG) {
    out[p.slug] = effectiveActive(p.slug, p.active);
  }
  return out;
}

/**
 * Ativa/desativa UM plano para venda, gravando o override (SystemSetting) e
 * espelhando na coluna real `Plan.active`. Ambas as escritas são feitas para o
 * checkout e a listagem refletirem a decisão imediatamente.
 *
 * NÃO altera assinaturas vigentes: desativar vende apenas para NOVAS compras.
 */
export async function setPlanActive(
  slug: string,
  active: boolean
): Promise<{ slug: string; active: boolean }> {
  if (!CATALOG_SLUGS.has(slug)) {
    throw new Error(`Plano desconhecido: ${slug}`);
  }
  // 1) Override (fonte de verdade que o self-heal respeita).
  const current = await readActiveOverrides();
  current[slug] = active;
  await saveActiveOverrides(current);

  // 2) Coluna real `Plan.active` (o que o checkout/lista leem). Best-effort:
  //    se a linha ainda não existir, o self-heal a cria já com o override.
  try {
    await bll.plan.updateMany({ where: { slug }, data: { active } });
  } catch {
    // banco indisponível — o override já garante a intenção no próximo self-heal
  }

  return { slug, active };
}

/** Rótulo comercial curto de um plano (não-legado vs legado). */
export function planKind(slug: string): "sellable" | "legacy" {
  return isLegacyPlan(slug) ? "legacy" : "sellable";
}
