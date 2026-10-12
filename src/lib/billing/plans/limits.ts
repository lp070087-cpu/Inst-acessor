/**
 * FRANQUIAS POR PLANO (núcleo puro)
 * =================================
 * Define, por plano, quantas vezes cada capacidade pode ser usada por DIA e por
 * CICLO. É a fonte única — o medidor no servidor, o painel do admin e a tela do
 * usuário leem TUDO daqui.
 *
 * ⚠️ ATIVAÇÃO COMERCIAL PENDENTE. Os números abaixo foram PROPOSTOS pelo
 * proprietário para avaliação. O mecanismo de medição está implementado, mas a
 * cobrança/bloqueio por franquia só deve valer depois da aprovação explícita —
 * ver `LIMITS_ENFORCEMENT_ENABLED`.
 *
 * REGRA ABSOLUTA: nenhuma franquia pode bloquear o RANK. Rank, XP, conquistas e
 * metas são de TODOS os usuários, de qualquer plano, até o nível máximo. Franquia
 * limita USO DE CAPACIDADE (geração de IA, publicações, análises), nunca
 * progressão. Não confundir o NOME dos planos (Elite, Master) com os NÍVEIS do
 * Rank.
 */

/** Capacidades medidas. Cada uma tem limite diário e por ciclo. */
export type QuotaFeature =
  | "ai_generation" // gerações de IA (copy, ideias, chat, diagnóstico…)
  | "auto_reply" // respostas automáticas a comentários/DM
  | "profile_analysis" // análises de perfil
  | "publication" // publicações efetivamente executadas
  | "automation_rule"; // regras de automação ATIVAS (é um teto, não um contador)

export interface PlanQuota {
  /** Gerações de IA por DIA (reinicia 00:00 de Brasília). `null` = sem teto. */
  aiPerDay: number | null;
  /** Gerações de IA por CICLO contratado. */
  aiPerCycle: number | null;
  /** Respostas automáticas por CICLO. */
  autoRepliesPerCycle: number | null;
  /** Análises de perfil por CICLO. */
  profileAnalysisPerCycle: number | null;
  /** Publicações executadas por CICLO. */
  publicationsPerCycle: number | null;
  /** Teto de regras de automação ATIVAS ao mesmo tempo (não é consumo). */
  activeAutomationRules: number | null;
  /** Contas sociais conectadas ao mesmo tempo (teto, não consumo). */
  connectedAccounts: number | null;
}

/**
 * Franquias propostas. O Semanal mantém o comportamento ATUAL (sem franquia) até
 * um diagnóstico próprio — por isso todos os limites são `null` nele.
 */
export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  // Semanal: preserva os limites existentes (nenhum) — diagnóstico separado.
  semanal: {
    aiPerDay: null,
    aiPerCycle: null,
    autoRepliesPerCycle: null,
    profileAnalysisPerCycle: null,
    publicationsPerCycle: null,
    activeAutomationRules: null,
    connectedAccounts: null,
  },
  // Planos legados (mensal/anual) seguem sem franquia enquanto estiverem ativos:
  // aplicar limite retroativo a um contrato vigente exige regra explícita.
  mensal: {
    aiPerDay: null,
    aiPerCycle: null,
    autoRepliesPerCycle: null,
    profileAnalysisPerCycle: null,
    publicationsPerCycle: null,
    activeAutomationRules: null,
    connectedAccounts: null,
  },
  anual: {
    aiPerDay: null,
    aiPerCycle: null,
    autoRepliesPerCycle: null,
    profileAnalysisPerCycle: null,
    publicationsPerCycle: null,
    activeAutomationRules: null,
    connectedAccounts: null,
  },
  // ------- NOVOS PLANOS (proposta — ativação pendente de aprovação) -------
  start: {
    aiPerDay: 10,
    aiPerCycle: 100,
    autoRepliesPerCycle: 100,
    profileAnalysisPerCycle: 4,
    publicationsPerCycle: 15,
    activeAutomationRules: 2,
    connectedAccounts: 1,
  },
  essencial: {
    aiPerDay: 25,
    aiPerCycle: 300,
    autoRepliesPerCycle: 300,
    profileAnalysisPerCycle: 12,
    publicationsPerCycle: 40,
    activeAutomationRules: 5,
    connectedAccounts: 1,
  },
  pro: {
    aiPerDay: 50,
    aiPerCycle: 700,
    autoRepliesPerCycle: 800,
    profileAnalysisPerCycle: 30,
    publicationsPerCycle: 80,
    activeAutomationRules: 10,
    connectedAccounts: 2,
  },
  elite: {
    aiPerDay: 100,
    aiPerCycle: 1500,
    autoRepliesPerCycle: 2000,
    profileAnalysisPerCycle: 60,
    publicationsPerCycle: 150,
    activeAutomationRules: 20,
    connectedAccounts: 3,
  },
  master: {
    aiPerDay: 200,
    aiPerCycle: 3000,
    autoRepliesPerCycle: 4000,
    profileAnalysisPerCycle: 120,
    publicationsPerCycle: 250,
    activeAutomationRules: 40,
    connectedAccounts: 5,
  },
};

// ---------------------------------------------------------------------------
// OVERRIDES DO ADMIN (persistidos em `SystemSetting`, nunca no código)
// ---------------------------------------------------------------------------
/**
 * `PLAN_QUOTAS` acima é o PADRÃO EM CÓDIGO — imutável e versionado. O painel
 * admin NÃO reescreve este arquivo (seria reescrever código em runtime, com
 * risco de divergir do que está versionado): ele grava um OVERRIDE em
 * `SystemSetting` (key `billing.limits.v1`), e `quotaForPlan()` consulta esse
 * override em runtime.
 *
 * O override é PARCIAL por slug: só as chaves que o admin realmente editou
 * aparecem. Chave ausente = vale o padrão do código. Isto permite que um ajuste
 * pontual (ex.: só `aiPerDay`) não congele os outros seis limites.
 *
 * O registro abaixo é um CACHE EM MEMÓRIA preenchido pela camada de banco
 * (`plans/limits-db.ts`). O módulo continua PURO e determinístico por padrão:
 * sem nada aplicado, `quotaForPlan()` devolve exatamente `PLAN_QUOTAS` — é o que
 * os testes de `bench/test-quotas.mjs` assumem.
 */
export type PlanQuotaOverrides = Record<string, Partial<PlanQuota>>;

let quotaOverrides: PlanQuotaOverrides = {};

/** Aplica (ou limpa) os overrides vigentes. Chamado pela camada de banco. */
export function applyQuotaOverrides(overrides: PlanQuotaOverrides): void {
  quotaOverrides = overrides ?? {};
}

/** Remove os overrides do processo (fallback explícito ao código). Usado em testes. */
export function clearQuotaOverrides(): void {
  quotaOverrides = {};
}

/** Snapshot dos overrides vigentes (para diagnóstico/painel). */
export function currentQuotaOverrides(): PlanQuotaOverrides {
  return quotaOverrides;
}

/**
 * Franquia EFETIVA de um slug: padrão do código com o override sobreposto.
 * Slug desconhecido cai no Semanal (mesma regra de `quotaForPlan`).
 */
export function effectiveQuota(slug: string): PlanQuota {
  const base = PLAN_QUOTAS[slug] ?? PLAN_QUOTAS.semanal;
  const override = quotaOverrides[slug];
  return override ? { ...base, ...override } : base;
}

/**
 * INTERRUPTOR DE ATIVAÇÃO COMERCIAL.
 *
 * `false` = o medidor RODA e REGISTRA (para diagnóstico e para o painel), mas
 * NÃO bloqueia nada. É o estado correto enquanto o proprietário não aprovar os
 * números: ninguém fica bloqueado por uma franquia que ainda não foi comunicada
 * nem contratada, e ao mesmo tempo temos dados reais de consumo para calibrar.
 *
 * Virar para `true` é a decisão comercial final — não é um ajuste técnico.
 */
export const LIMITS_ENFORCEMENT_ENABLED = false;

/**
 * Franquia EFETIVA de um plano.
 *
 * Precedência: override do admin (se o registro tiver sido carregado) →
 * padrão em código (`PLAN_QUOTAS`) → Semanal para slug desconhecido/nulo
 * (fail-open controlado: nunca inventa teto para um plano que não conhece).
 */
export function quotaForPlan(slug: string | null | undefined): PlanQuota {
  if (!slug) return effectiveQuota("semanal");
  return effectiveQuota(slug);
}

export type QuotaWindow = "day" | "cycle";

export interface QuotaDecision {
  allowed: boolean;
  /** Limite aplicável naquela janela (`null` = sem teto). */
  limit: number | null;
  used: number;
  remaining: number | null;
  window: QuotaWindow;
  feature: QuotaFeature;
  /** Motivo quando bloqueado; `null` quando liberado. */
  reason: "daily_limit" | "cycle_limit" | null;
}

/** Lê o limite da franquia para uma capacidade+janela. */
export function limitFor(
  quota: PlanQuota,
  feature: QuotaFeature,
  window: QuotaWindow
): number | null {
  switch (feature) {
    case "ai_generation":
      return window === "day" ? quota.aiPerDay : quota.aiPerCycle;
    case "auto_reply":
      return window === "day" ? null : quota.autoRepliesPerCycle;
    case "profile_analysis":
      return window === "day" ? null : quota.profileAnalysisPerCycle;
    case "publication":
      return window === "day" ? null : quota.publicationsPerCycle;
    case "automation_rule":
      return window === "day" ? null : quota.activeAutomationRules;
    default:
      return null;
  }
}

/**
 * Decide se UMA unidade de consumo é permitida.
 *
 * Regra dura: o usuário precisa respeitar SIMULTANEAMENTE o limite diário e o do
 * ciclo. O mais restritivo vence — não adianta ter saldo no ciclo se o dia
 * acabou, nem o contrário.
 *
 * NUNCA bloqueia quando `LIMITS_ENFORCEMENT_ENABLED` é falso (modo medição).
 */
export function evaluateQuota(input: {
  quota: PlanQuota;
  feature: QuotaFeature;
  usedToday: number;
  usedThisCycle: number;
  enforcementEnabled?: boolean;
}): QuotaDecision {
  const { quota, feature, usedToday, usedThisCycle } = input;
  const enabled = input.enforcementEnabled ?? LIMITS_ENFORCEMENT_ENABLED;

  const dailyLimit = limitFor(quota, feature, "day");
  const cycleLimit = limitFor(quota, feature, "cycle");

  const base = (window: QuotaWindow, limit: number | null, used: number) => ({
    limit,
    used,
    remaining: limit == null ? null : Math.max(0, limit - used),
    window,
    feature,
  });

  if (!enabled) {
    // Modo medição: registra o consumo, nunca barra. Reportamos a janela mais
    // restritiva apenas para o painel saber o que SERIA aplicado.
    const d = base("day", dailyLimit, usedToday);
    const c = base("cycle", cycleLimit, usedThisCycle);
    const tighter = dailyLimit != null && cycleLimit != null
      ? (d.remaining ?? Infinity) <= (c.remaining ?? Infinity) ? d : c
      : dailyLimit != null ? d : c;
    return { allowed: true, reason: null, ...tighter };
  }

  // Diário primeiro (é o que o usuário percebe mais rápido).
  if (dailyLimit != null && usedToday >= dailyLimit) {
    return { allowed: false, reason: "daily_limit", ...base("day", dailyLimit, usedToday) };
  }
  if (cycleLimit != null && usedThisCycle >= cycleLimit) {
    return { allowed: false, reason: "cycle_limit", ...base("cycle", cycleLimit, usedThisCycle) };
  }

  return { allowed: true, reason: null, ...base("day", dailyLimit, usedToday) };
}

/**
 * Teto de um recurso que NÃO é consumo (regras ativas, contas conectadas).
 * Diferente de `evaluateQuota`: aqui `current` é quantos JÁ existem.
 */
export function evaluateCap(input: {
  quota: PlanQuota;
  feature: "automation_rule" | "connected_accounts";
  current: number;
  enforcementEnabled?: boolean;
}): { allowed: boolean; limit: number | null } {
  const limit =
    input.feature === "automation_rule"
      ? input.quota.activeAutomationRules
      : input.quota.connectedAccounts;
  const enabled = input.enforcementEnabled ?? LIMITS_ENFORCEMENT_ENABLED;
  if (!enabled || limit == null) return { allowed: true, limit };
  return { allowed: input.current < limit, limit };
}
