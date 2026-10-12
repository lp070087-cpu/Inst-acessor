/**
 * PLANOS — CATÁLOGO OFICIAL (imutável, puro)
 * ============================================
 * Fonte de verdade do catálogo de planos. Módulo SEM dependências de banco
 * para permitir testes determinísticos sem instanciar o Prisma client.
 *
 * ESTRUTURA COMERCIAL (definida pelo proprietário em 2026-10-08):
 *   Semanal   R$  27,00  →  2700   ONE_TIME,  7 dias, SEM renovação automática
 *   Start     R$  43,00  →  4300   RECURRING MONTH
 *   Essencial R$  87,00  →  8700   RECURRING MONTH
 *   Pro       R$ 125,00  → 12500   RECURRING MONTH
 *   Elite     R$ 171,00  → 17100   RECURRING MONTH
 *   Master    R$ 248,00  → 24800   RECURRING MONTH
 *
 * ⚠️ ATIVAÇÃO COMERCIAL DOS NOVOS PLANOS ESTÁ PENDENTE DE APROVAÇÃO.
 * Os planos novos entram com `active: false` — existem no catálogo (para o
 * painel admin, o medidor de franquia e os testes) mas NÃO são vendidos nem
 * aparecem no checkout enquanto o proprietário não aprovar. Ativar é trocar
 * `active` para true — uma decisão comercial, não técnica.
 *
 * PLANOS LEGADOS (`mensal`, `anual`): mantidos no catálogo e DESATIVADOS para
 * novas vendas. NÃO foram removidos: existem assinaturas e pedidos históricos
 * que dependem deles (renovação, revogação por estorno, exibição).
 * `getPlanById` continua resolvendo o slug — um contrato vigente segue sendo
 * cobrado e exibido normalmente. Remover quebraria contratos e o histórico.
 *
 * Preços SEMPRE em centavos inteiros (nunca Float para dinheiro).
 *
 * Checkout oficial: ASAAS (checkout hospedado público — POST /v3/checkouts).
 * O catálogo NÃO guarda URL de pagamento estática: cada compra cria um
 * checkout único no servidor (preço/duração/ciclo SEMPRE resolvidos aqui —
 * nunca vindos do browser).
 */

/** Todos os planos liberam as mesmas capacidades; a franquia é que difere. */
const FEATURES_BASE = [
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
] as const;

/**
 * Ordem de exibição na landing. A landing lê ESTA lista — e é por isso que
 * ativar um plano novo aqui muda a página de vendas. Enquanto a ativação
 * comercial estiver pendente, a lista permanece a atual (`semanal` + legados),
 * preservando a landing exatamente como está.
 */
export const LANDING_PLAN_ORDER = ["semanal", "mensal", "anual"] as const;

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
    features: [...FEATURES_BASE],
    badge: null,
    active: true,
    sortOrder: 1,
  },
  // ---------------------------------------------------------------- LEGADOS
  // Desativados para NOVAS vendas; preservados para contratos e histórico.
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
    features: [...FEATURES_BASE],
    badge: "MAIS_ESCOLHIDO",
    active: true,
    sortOrder: 2,
    legacy: true,
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
    features: [...FEATURES_BASE],
    badge: "MELHOR_CUSTO_BENEFICIO",
    active: true,
    sortOrder: 3,
    legacy: true,
  },
  // ------------------------------------------------------------ NOVOS PLANOS
  // `active: false` = preparados, NÃO comercializados até aprovação explícita.
  {
    slug: "start",
    name: "Inst Acessor Start",
    priceCents: 4300,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description: "Assinatura mensal para quem está começando com constância.",
    features: [...FEATURES_BASE],
    badge: null,
    active: false,
    sortOrder: 10,
  },
  {
    slug: "essencial",
    name: "Inst Acessor Essencial",
    priceCents: 8700,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description: "Assinatura mensal com mais capacidade de produção e análise.",
    features: [...FEATURES_BASE],
    badge: "MAIS_ESCOLHIDO",
    active: false,
    sortOrder: 11,
  },
  {
    slug: "pro",
    name: "Inst Acessor Pro",
    priceCents: 12500,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description: "Assinatura mensal para quem opera várias frentes de conteúdo.",
    features: [...FEATURES_BASE],
    badge: null,
    active: false,
    sortOrder: 12,
  },
  {
    slug: "elite",
    name: "Inst Acessor Elite",
    priceCents: 17100,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description:
      "Assinatura mensal com capacidade ampliada. NÃO é requisito para alcançar Ranks altos — nenhum Rank é bloqueado por plano.",
    features: [...FEATURES_BASE],
    badge: null,
    active: false,
    sortOrder: 13,
  },
  {
    slug: "master",
    name: "Inst Acessor Master",
    priceCents: 24800,
    currency: "BRL",
    type: "RECURRING",
    billingInterval: "MONTH",
    durationDays: 30,
    description:
      "Assinatura mensal com a maior capacidade da plataforma. NÃO é requisito para alcançar Ranks altos — nenhum Rank é bloqueado por plano.",
    features: [...FEATURES_BASE],
    badge: "MELHOR_CUSTO_BENEFICIO",
    active: false,
    sortOrder: 14,
  },
] as const;

export type PlanSlug = (typeof PLAN_CATALOG)[number]["slug"];

/** `true` nos planos mantidos por compatibilidade (mensal, anual). */
export function isLegacyPlan(slug: string): boolean {
  return PLAN_CATALOG.some((p) => p.slug === slug && "legacy" in p && p.legacy === true);
}

// ---------------------------------------------------------------------------
// OVERRIDES DE ATIVAÇÃO COMERCIAL (persistidos em `SystemSetting`)
// ---------------------------------------------------------------------------
/**
 * `active` no catálogo acima é o ESTADO PADRÃO/INICIAL, versionado em código. O
 * liga/desliga COMERCIAL do proprietário NÃO reescreve este arquivo: vira um
 * OVERRIDE gravado em `SystemSetting` (key `billing.plan-active.v1`) e lido pela
 * camada de banco (`./activation-db`).
 *
 * Por que um override e não gravar direto no catálogo: o catálogo também é usado
 * pelo self-heal (`ensureCatalogPlans`), que reescreve a linha `Plan` a partir
 * dele a cada `listPlans()`. Se o liga/desliga vivesse só no catálogo em memória,
 * sumiria no próximo deploy; se vivesse só na coluna `Plan.active` do banco, o
 * self-heal a sobrescreveria de volta pelo padrão. O override é a fonte de
 * verdade que o self-heal RESPEITA — então a decisão do dono sobrevive aos dois.
 *
 * O registro abaixo é um CACHE EM MEMÓRIA; sem nada aplicado, `effectiveActive`
 * devolve exatamente o `active` do catálogo (comportamento atual preservado).
 */
let activeOverrides: Record<string, boolean> = {};

/** Aplica (ou limpa) os overrides de ativação vigentes. */
export function applyActiveOverrides(overrides: Record<string, boolean>): void {
  activeOverrides = overrides ?? {};
}

/** Snapshot dos overrides vigentes (diagnóstico/painel). */
export function currentActiveOverrides(): Record<string, boolean> {
  return activeOverrides;
}

/** `active` EFETIVO de um slug: override do admin quando houver, senão o padrão. */
export function effectiveActive(slug: string, catalogActive: boolean): boolean {
  return typeof activeOverrides[slug] === "boolean" ? activeOverrides[slug] : catalogActive;
}

/** `active` EFETIVO de um plano do catálogo, pelo slug. */
export function isPlanActive(slug: string): boolean {
  const plan = PLAN_CATALOG.find((p) => p.slug === slug);
  if (!plan) return false;
  return effectiveActive(plan.slug, plan.active);
}
