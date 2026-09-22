import { bll } from "@/lib/billing/db";
import { settings } from "@/lib/admin/settings-db";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import {
  DEFAULT_PROMO,
  PROMO_SETTING_KEY,
  parsePromoConfig,
  planPromoDisplay,
  resolvePromoPrice,
  type BuyerHistory,
  type PlanPromoDisplay,
  type PlanPromoShowcase,
  type PromoConfig,
  type PromoResolution,
} from "@/lib/billing/promo";

/**
 * PROMOÇÃO — LEITURA/GRAVAÇÃO (P17–P21)
 * ======================================
 * Toda a configuração vive no model `SystemSetting`, que JÁ EXISTE no schema
 * (id, key @unique, value, createdAt, updatedAt). Por isso esta funcionalidade
 * NÃO exige migration e NÃO altera o banco — apenas grava uma linha nova com
 * uma `key` própria quando o admin mexe no painel.
 *
 * Degradação honesta: se o banco não responder, devolvemos o PADRÃO de
 * pré-venda (que é o que o produto anuncia) em vez de "sem promoção". Nos dois
 * casos o valor cobrado continua sendo o do catálogo, jamais um número
 * inventado no cliente.
 */

/** Status que contam como cobrança CONFIRMADA (nunca "PENDING"). */
const CONFIRMED_STATUSES = ["PAID", "CONFIRMED", "RECEIVED"] as const;

/** Lê a configuração. Nunca lança. */
export async function getPromoConfig(): Promise<PromoConfig> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: PROMO_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return DEFAULT_PROMO;
    return parsePromoConfig(row.value);
  } catch {
    return DEFAULT_PROMO;
  }
}

/** Grava a configuração (admin). Devolve a config normalizada que ficou salva. */
export async function savePromoConfig(raw: unknown): Promise<PromoConfig> {
  const normalized = parsePromoConfig(raw);
  const value = JSON.stringify(normalized);
  await settings.systemSetting.upsert({
    where: { key: PROMO_SETTING_KEY },
    create: { key: PROMO_SETTING_KEY, value },
    update: { value },
  });
  return normalized;
}

/**
 * HISTÓRICO REAL do comprador, medido a partir de pagamentos JÁ REGISTRADOS
 * (`Payment.status` confirmado). Não pergunta nada ao cliente e não confia em
 * campo enviado pelo navegador.
 *
 * Conta por período cobrado, não por linha:
 *  - semanal → pagamento único, conta no total (`confirmedPaymentsTotal`)
 *  - mensal  → quantos pagamentos confirmados nesse ciclo
 *  - anual   → quantos pagamentos confirmados nesse ciclo
 *
 * Sem `userId` (comprador anônimo, ainda sem conta) o histórico é VAZIO — que é
 * exatamente o caso da primeira compra.
 */
export async function getBuyerHistory(userId: string | null | undefined): Promise<BuyerHistory> {
  const empty: BuyerHistory = {
    confirmedPaymentsTotal: 0,
    confirmedMonthlyCharges: 0,
    confirmedYearlyCharges: 0,
  };
  if (!userId) return empty;

  try {
    const payment = (
      bll as unknown as {
        payment: {
          findMany(args: unknown): Promise<
            { planId: string | null }[]
          >;
        };
      }
    ).payment;

    const rows = await payment.findMany({
      where: {
        userId,
        status: { in: [...CONFIRMED_STATUSES] },
      },
      select: { planId: true },
    });

    if (!rows || rows.length === 0) return empty;

    // Resolvemos o slug pelo catálogo — não por string solta no banco.
    const { PLAN_CATALOG } = await import("./plans/catalog");
    const slugByPlanId = new Map<string, string>();
    try {
      const plans = (await bll.plan.findMany({ select: { id: true, slug: true } })) as unknown as {
        id: string;
        slug: string;
      }[];
      for (const pl of plans) slugByPlanId.set(pl.id, pl.slug);
    } catch {
      // sem a tabela de planos ainda dá para casar por id de catálogo
    }
    for (const c of PLAN_CATALOG) slugByPlanId.set(`plan:${c.slug}`, c.slug);

    let total = 0;
    let monthly = 0;
    let yearly = 0;
    for (const r of rows) {
      total++;
      const slug = r.planId ? slugByPlanId.get(r.planId) : undefined;
      if (slug === "mensal") monthly++;
      else if (slug === "anual") yearly++;
    }

    return {
      confirmedPaymentsTotal: total,
      confirmedMonthlyCharges: monthly,
      confirmedYearlyCharges: yearly,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// API usada pelo servidor
// ---------------------------------------------------------------------------

/** Preço a COBRAR agora para este comprador. Server-side, sempre. */
export async function resolveCheckoutPrice(input: {
  slug: string;
  basePriceCents: number;
  userId?: string | null;
  now?: string;
}): Promise<PromoResolution> {
  const config = await getPromoConfig();
  const history = await getBuyerHistory(input.userId ?? null);
  return resolvePromoPrice({
    slug: input.slug,
    basePriceCents: input.basePriceCents,
    config,
    history,
    now: input.now ?? new Date().toISOString(),
  });
}

/**
 * Vitrine: preço cheio + preço promocional dos planos, para os cards da
 * landing e de "Minha Assinatura". Sem histórico — a elegibilidade individual
 * é decidida no checkout.
 *
 * `infraOk === false` significa: o banco não respondeu e estamos exibindo o
 * padrão. A UI pode (deve) avisar em vez de fingir que é a config real.
 */
export async function getPlanPromoDisplay(now?: string): Promise<PlanPromoDisplay> {
  let config = DEFAULT_PROMO;
  let infraOk = true;
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: PROMO_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (row?.value != null) config = parsePromoConfig(row.value);
  } catch {
    infraOk = false;
  }

  // Preço cheio SEMPRE do catálogo oficial. Não existe mais um mapa-espelho de
  // reserva: se este valor não vier do catálogo, é porque o catálogo não existe,
  // e nesse caso não há preço honesto a mostrar.
  const base: Record<string, number> = Object.fromEntries(
    PLAN_CATALOG.map((c) => [c.slug, c.priceCents])
  );

  const iso = now ?? new Date().toISOString();
  const bySlug: Record<string, PlanPromoShowcase> = {};
  for (const slug of Object.keys(base)) {
    bySlug[slug] = planPromoDisplay({ slug, basePriceCents: base[slug], config, now: iso });
  }

  return { config, bySlug, infraOk };
}
