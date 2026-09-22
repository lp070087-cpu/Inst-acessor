/**
 * PLANOS — APRESENTAÇÃO (puro, sem banco)
 * =======================================
 * Fonte ÚNICA de tudo que é DERIVADO de um plano: valor formatado, rótulo de
 * periodicidade, sufixo de preço, nome curto e o comparativo do plano anual.
 *
 * Este módulo NÃO importa Prisma (`@/lib/billing/db`) nem `./index` — só o
 * catálogo puro (`./catalog`). Isso permite que componentes de SERVIDOR
 * (landing, /checkout) e de CLIENTE (checkout-form, assinatura-client) leiam a
 * mesma regra sem arrastar o client do banco para o bundle do navegador.
 *
 * REGRA PERMANENTE: nenhum componente deve voltar a escrever "R$ 27,00",
 * "/mês" ou "cobrança mensal recorrente" por conta própria.
 *   - Os VALORES/nomes/descrições comerciais vivem em `./catalog` (PLAN_CATALOG).
 *   - As REGRAS de formatação vivem aqui, derivadas de
 *     `type` / `billingInterval` / `durationDays` — nunca de um slug específico.
 * Assim, mudar o preço ou o ciclo no catálogo reflete em landing, checkout e
 * Minha Assinatura sem tocar em nenhum componente.
 */

/**
 * Reexporta o catálogo oficial para que os consumidores tenham UM único
 * caminho de importação (`@/lib/billing/plans/display`) quando precisarem do
 * catálogo puro + das regras de apresentação, sem risco de puxar o Prisma.
 */
export { PLAN_CATALOG, type PlanSlug } from "./catalog";
// Import LOCAL (além do reexport acima) porque `planAfterText` precisa do valor
// em tempo de execução — um `export { } from` não cria binding neste módulo.
import { PLAN_CATALOG } from "./catalog";

/** Forma mínima aceita pelos helpers — serve tanto para `PlanView` quanto para o catálogo. */
export interface PlanShape {
  slug: string;
  name: string;
  priceCents: number;
  type: string;
  billingInterval: string | null;
  durationDays?: number | null;
}

/** Formata centavos inteiros como moeda brasileira. Única implementação do app. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Nome do plano sem o prefixo da marca ("Inst acessor Semanal" → "Semanal"). */
export function planShortName(plan: Pick<PlanShape, "name">): string {
  return plan.name.replace(/^Inst acessor\s*/i, "");
}

/** Duração em linguagem natural: 365 → "12 meses", 30 → "1 mês", 7 → "7 dias". */
function durationInWords(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years * 12} meses`;
  }
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
  return `${days} dias`;
}

/**
 * Sufixo que acompanha o preço no card ("/semana", "/mês", "/ano").
 * Devolve "" quando a duração não corresponde a um período conhecido.
 */
export function planPriceSuffix(
  plan: Pick<PlanShape, "type" | "billingInterval" | "durationDays">
): string {
  if (plan.type === "RECURRING") {
    if (plan.billingInterval === "YEAR") return "/ano";
    if (plan.billingInterval === "MONTH") return "/mês";
    return "";
  }
  const days = plan.durationDays ?? null;
  if (days === 7) return "/semana";
  if (days === 30) return "/mês";
  if (days === 365) return "/ano";
  return "";
}

/** Período exibido no card da LANDING ("por semana", "por mês", "por ano"). */
export function planLandingPeriod(
  plan: Pick<PlanShape, "type" | "billingInterval" | "durationDays">
): string {
  if (plan.type === "RECURRING") {
    if (plan.billingInterval === "YEAR") return "por ano";
    if (plan.billingInterval === "MONTH") return "por mês";
    return "por período";
  }
  const days = plan.durationDays ?? null;
  if (days === 7) return "por semana";
  if (days === 30) return "por mês";
  if (days === 365) return "por ano";
  return days ? `por ${days} dias` : "pagamento único";
}

/**
 * O que o plano passa a custar DEPOIS da pré-venda — texto do card.
 *
 * Existe para o MESMO card poder mostrar "Depois R$ 77,00/mês" / "Renovação por
 * R$ 547,00/ano" também quando a promoção está DESLIGADA: nesse caso não há "de
 * X por Y", mas o ciclo continua sendo a informação comercial relevante.
 *
 * Derivado de `type`/`billingInterval`, nunca de um slug — o mesmo motivo de
 * `planLandingPeriod`. Compra ÚNICA devolve `null`: não há "depois" em algo que
 * não se repete (é o caso do semanal).
 */
export function planAfterText(
  slug: string,
  priceCents: number
): string | null {
  const plan = PLAN_CATALOG.find((p) => p.slug === slug) ?? null;
  if (!plan || plan.type !== "RECURRING") return null;
  if (plan.billingInterval === "YEAR") return `Renovação por ${formatBRL(priceCents)}/ano`;
  if (plan.billingInterval === "MONTH") return `Depois ${formatBRL(priceCents)}/mês`;
  return null;
}

/**
 * Frase de período do CHECKOUT — regra comercial oficial:
 *   - pagamento único (ONE_TIME)  → "pagamento único · acesso de N dias"
 *   - recorrente mensal           → "cobrança mensal recorrente"
 *   - recorrente anual            → "cobrança anual · acesso por 12 meses"
 */
export function planPeriodLabel(plan: PlanShape): string {
  if (plan.type !== "RECURRING") {
    const days = plan.durationDays ?? null;
    return days ? `pagamento único · acesso de ${days} dias` : "pagamento único";
  }
  if (plan.billingInterval === "YEAR") {
    const days = plan.durationDays ?? null;
    return days
      ? `cobrança anual · acesso por ${durationInWords(days)}`
      : "cobrança anual · acesso por 12 meses";
  }
  if (plan.billingInterval === "MONTH") return "cobrança mensal recorrente";
  return "cobrança recorrente";
}

/**
 * Rótulo do tipo de cobrança em MINHA ASSINATURA (linha de detalhe).
 * Aceita `PlanView` (`type`) ou `SubscriptionView` (`billingType`) — os
 * chamadores passam `{ type: s.billingType, billingInterval: s.billingInterval }`.
 */
export function planBillingLabel(plan: {
  type: string;
  billingInterval: string | null;
}): string {
  if (plan.type !== "RECURRING") return "Pagamento único";
  if (plan.billingInterval === "MONTH") return "Mensal (recorrente)";
  if (plan.billingInterval === "YEAR") return "Anual (recorrente)";
  return "Recorrente";
}

/**
 * Comparativo do plano anual contra 12 meses do mensal — calculado a partir dos
 * PREÇOS REAIS da lista recebida (nunca de números escritos no componente).
 * Devolve `null` quando não há os dois planos ou quando não há economia.
 */
export function annualVsMonthly(plans: readonly PlanShape[]): {
  perMonthCents: number;
  twelveMonthsCents: number;
  savingsCents: number;
} | null {
  const yearly = plans.find(
    (p) => p.type === "RECURRING" && p.billingInterval === "YEAR"
  );
  const monthly = plans.find(
    (p) => p.type === "RECURRING" && p.billingInterval === "MONTH"
  );
  if (!yearly || !monthly) return null;
  const twelveMonthsCents = monthly.priceCents * 12;
  const savingsCents = twelveMonthsCents - yearly.priceCents;
  if (savingsCents <= 0) return null;
  return {
    perMonthCents: Math.round(yearly.priceCents / 12),
    twelveMonthsCents,
    savingsCents,
  };
}

/**
 * Benefícios exibidos no card da LANDING.
 *
 * É a MESMA carteira de recursos do catálogo (`PLAN_CATALOG[].features`) escrita
 * em linguagem de venda: o catálogo lista os recursos um a um (17 itens, usados
 * no checkout e em Minha Assinatura) e aqui eles aparecem agrupados em 8
 * benefícios — exatamente porque TODOS os planos liberam os MESMOS recursos e a
 * diferença entre eles é apenas o período. Não é uma segunda fonte de verdade
 * comercial: não contém preço, duração nem ciclo.
 */
export const LANDING_PLAN_FEATURES = [
  "Instagram + TikTok conectados",
  "Dashboard com Score de crescimento",
  "IA Acessor + Cérebro Estratégico",
  "Diagnóstico + Central de Ideias",
  "Gerador de Copy + Preview Social",
  "Calendário + Planejamento",
  "Mentoria + Análise de desempenho",
  "Rank com XP, Metas e Conquistas",
] as const;
