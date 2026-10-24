import { settings } from "@/lib/admin/settings-db";
import {
  PLAN_QUOTAS,
  applyQuotaOverrides,
  type PlanQuota,
  type PlanQuotaOverrides,
} from "@/lib/billing/plans/limits";

/**
 * FRANQUIAS — OVERRIDES DO ADMIN (leitura/gravação)
 * =================================================
 * `PLAN_QUOTAS` (em `./limits`) é o PADRÃO EM CÓDIGO, imutável e versionado. Esta
 * camada permite ao ADMIN ajustar limites SEM reescrever código: o ajuste vira um
 * OVERRIDE gravado no model `SystemSetting` (que JÁ EXISTE — nenhuma migration).
 *
 * PRECEDÊNCIA (a mesma que `quotaForPlan` aplica):
 *   1. override do admin (esta key) — só as chaves presentes no override;
 *   2. padrão em código (`PLAN_QUOTAS`);
 *   3. Semanal, para slug desconhecido/nulo.
 *
 * Nada aqui inventa valor: um override ausente ou inválido simplesmente NÃO
 * existe, e vale o padrão do código. O código continua sendo a fonte de verdade
 * de última instância — e por isso os testes de `bench/test-quotas.mjs` seguem
 * valendo: sem override aplicado, `quotaForPlan` devolve exatamente `PLAN_QUOTAS`.
 *
 * ⚠️ PRECEDÊNCIA SOBRE CONTRATOS VIGENTES: um override NÃO altera
 * retroativamente o contrato de quem já assinou. Ele muda o que a plataforma
 * aplica dali em diante. Aplicar retroativamente exigiria regra explícita — que
 * não é implementada de propósito.
 */

/** Chave única em `SystemSetting` onde o admin grava os overrides de franquia. */
export const LIMITS_SETTING_KEY = "billing.limits.v1";

/** Campos de uma franquia, na ordem de exibição. Fonte única do conjunto válido. */
export const QUOTA_FIELDS = [
  "aiPerDay",
  "aiPerCycle",
  "autoRepliesPerCycle",
  "profileAnalysisPerCycle",
  "publicationsPerCycle",
  "activeAutomationRules",
  "connectedAccounts",
] as const;

export type QuotaField = (typeof QUOTA_FIELDS)[number];

/** Rótulos em pt-BR por campo de franquia (usado no painel e na auditoria). */
export const QUOTA_FIELD_LABELS: Record<QuotaField, string> = {
  aiPerDay: "IA / dia",
  aiPerCycle: "IA / ciclo",
  autoRepliesPerCycle: "Respostas automáticas / ciclo",
  profileAnalysisPerCycle: "Análises de perfil / ciclo",
  publicationsPerCycle: "Publicações / ciclo",
  activeAutomationRules: "Regras de automação ativas",
  connectedAccounts: "Contas conectadas",
};

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;
}

/**
 * Normaliza um payload cru (string JSON ou objeto) num mapa de overrides PARCIAL.
 *
 * Regras de honestidade:
 *  - slug fora do catálogo de franquias é DESCARTADO (não criamos limite para
 *    um plano que não existe);
 *  - campo desconhecido é DESCARTADO;
 *  - valor que não é `null` nem inteiro >= 0 é DESCARTADO (nunca viramos um
 *    "0" silencioso, que bloquearia tudo);
 *  - um slug cujo override ficou vazio é OMITIDO (volta ao padrão do código).
 */
export function parseQuotaOverrides(raw: unknown): PlanQuotaOverrides {
  if (typeof raw === "string") {
    try {
      return parseQuotaOverrides(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const o = raw as Record<string, unknown>;
  const out: PlanQuotaOverrides = {};

  for (const slug of Object.keys(PLAN_QUOTAS)) {
    const entry = o[slug];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const partial: Partial<PlanQuota> = {};
    let any = false;
    for (const field of QUOTA_FIELDS) {
      if (!(field in e)) continue;
      const v = e[field];
      if (v === null) {
        partial[field] = null;
        any = true;
      } else if (isNonNegativeInt(v)) {
        partial[field] = v;
        any = true;
      }
      // valor inválido: campo fica de fora → cai no padrão do código
    }
    if (any) out[slug] = partial;
  }
  return out;
}

/**
 * Lê os overrides gravados. NUNCA lança; em falha devolve `{}` (padrão do código).
 * Nome no padrão `getPromoConfig`/`getCapacityConfig` — leitura pura da key.
 */
export async function getQuotaOverrides(): Promise<PlanQuotaOverrides> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: LIMITS_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return {};
    return parseQuotaOverrides(row.value);
  } catch {
    return {};
  }
}

/**
 * Lê os overrides E os aplica ao registro em memória, de modo que `quotaForPlan`
 * passe a devolver a franquia EFETIVA nas próximas chamadas deste processo.
 * É o que o medidor e o painel chamam antes de avaliar consumo.
 */
export async function loadQuotaOverrides(): Promise<PlanQuotaOverrides> {
  const overrides = await getQuotaOverrides();
  applyQuotaOverrides(overrides);
  return overrides;
}

/** Grava os overrides (admin). Devolve o mapa normalizado que ficou salvo. */
export async function saveQuotaOverrides(raw: unknown): Promise<PlanQuotaOverrides> {
  const normalized = parseQuotaOverrides(raw);
  const value = JSON.stringify(normalized);
  await settings.systemSetting.upsert({
    where: { key: LIMITS_SETTING_KEY },
    create: { key: LIMITS_SETTING_KEY, value },
    update: { value },
  });
  applyQuotaOverrides(normalized);
  return normalized;
}

/**
 * Franquia EFETIVA de cada slug do catálogo, já com o override aplicado —
 * o que o painel exibe. Devolve também o padrão em código, para a tela poder
 * mostrar "padrão → efetivo" e deixar claro o que foi sobrescrito.
 */
export function quotasWithDefaults(overrides: PlanQuotaOverrides): Record<
  string,
  { effective: PlanQuota; default: PlanQuota; overridden: QuotaField[] }
> {
  const out: Record<
    string,
    { effective: PlanQuota; default: PlanQuota; overridden: QuotaField[] }
  > = {};
  for (const slug of Object.keys(PLAN_QUOTAS)) {
    const base = PLAN_QUOTAS[slug];
    const override = overrides[slug];
    out[slug] = {
      default: base,
      effective: override ? { ...base, ...override } : base,
      overridden: override
        ? (QUOTA_FIELDS.filter((f) => f in override) as unknown as QuotaField[])
        : [],
    };
  }
  return out;
}
