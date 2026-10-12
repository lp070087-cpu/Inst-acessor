/**
 * GATEWAYS — CONFIGURAÇÃO UNIFICADA (server-only)
 * ==============================================
 * Fonte única da configuração de gateways de pagamento. Vive em `SystemSetting`
 * key `billing.gateways.v1` (JSON) — nenhuma migration.
 *
 * Gateway oficial: Asaas (único com credenciais reais por enquanto).
 * Kiwify e Kacto são configuráveis mas inativos até haver credenciais
 * documentadas — o painel mostra "Configuração pendente".
 *
 * O módulo `src/lib/billing/infinitepay/config.ts` (legado) é PRESERVADO;
 * o painel novo apenas avisa que ele não é recomendado.
 *
 * Money: centavos inteiros (o catálogo já é). Este módulo não guarda preço.
 */

import { settings } from "@/lib/admin/settings-db";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import { getAsaasConfig, isAsaasConfigured as isAsaasEnvConfigured } from "@/lib/billing/asaas/config";

export const GATEWAY_SETTING_KEY = "billing.gateways.v1";

export type GatewayId = "asaas" | "kiwify" | "kacto";

export interface GatewayEntry {
  enabled: boolean;
  label: string;
  provider: string;
}

export interface GatewayConfig {
  gateways: Record<GatewayId, GatewayEntry>;
  plans: Record<string, string[]>;
  methods: { pix: boolean; card: boolean; boleto: boolean };
  checkoutUrls: Record<string, string>;
}

export const ALL_GATEWAYS: GatewayId[] = ["asaas", "kiwify", "kacto"];

export const GATEWAY_LABELS: Record<GatewayId, string> = {
  asaas: "Asaas (oficial)",
  kiwify: "Kiwify",
  kacto: "Kacto",
};

export const GATEWAY_PROVIDERS: Record<GatewayId, string> = {
  asaas: "asaas",
  kiwify: "kiwify",
  kacto: "kacto",
};

function defaultPlans(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of PLAN_CATALOG) out[p.slug] = ["asaas"];
  return out;
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  gateways: {
    asaas: { enabled: true, label: GATEWAY_LABELS.asaas, provider: "asaas" },
    kiwify: { enabled: false, label: GATEWAY_LABELS.kiwify, provider: "kiwify" },
    kacto: { enabled: false, label: GATEWAY_LABELS.kacto, provider: "kacto" },
  },
  plans: defaultPlans(),
  methods: { pix: true, card: true, boleto: false },
  checkoutUrls: {},
};

const VALID_SLUG_SET: Set<string> = new Set(PLAN_CATALOG.map((p) => p.slug));

/**
 * Valida checkout URL externo — usado como REDIRECT target.
 * Regras de segurança (mesmo rigor de CORS):
 *   - deve ser https:// (nunca http)
 *   - max 500 chars
 *   - deve ser URL válida
 */
export function isValidCheckoutUrl(v: string): boolean {
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > 500) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeCheckoutUrls(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const slug of Object.keys(o)) {
    if (!VALID_SLUG_SET.has(slug as string)) continue;
    const v = o[slug];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (!isValidCheckoutUrl(trimmed)) continue;
    out[slug] = trimmed;
  }
  return out;
}

function sanitizeGateways(raw: unknown): Record<GatewayId, GatewayEntry> {
  const base = structuredClone(DEFAULT_GATEWAY_CONFIG.gateways);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const id of ALL_GATEWAYS) {
    const entry = o[id];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.enabled === "boolean") base[id].enabled = e.enabled;
  }
  // labels/providers são fixos
  for (const id of ALL_GATEWAYS) {
    base[id].label = GATEWAY_LABELS[id];
    base[id].provider = GATEWAY_PROVIDERS[id];
  }
  return base;
}

function sanitizePlans(raw: unknown): Record<string, string[]> {
  const fallback = defaultPlans();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const p of PLAN_CATALOG) {
    const v = o[p.slug];
    if (!Array.isArray(v)) {
      out[p.slug] = fallback[p.slug];
      continue;
    }
    const allowed = v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is GatewayId => (ALL_GATEWAYS as string[]).includes(s));
    const deduped = [...new Set(allowed)];
    out[p.slug] = deduped.length > 0 ? deduped : fallback[p.slug];
  }
  return out;
}

function sanitizeMethods(raw: unknown): GatewayConfig["methods"] {
  const base = { ...DEFAULT_GATEWAY_CONFIG.methods };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const k of ["pix", "card", "boleto"] as const) {
    if (typeof o[k] === "boolean") base[k] = o[k] as boolean;
  }
  return base;
}

export function parseGatewayConfig(raw: unknown): GatewayConfig {
  if (typeof raw === "string") {
    try {
      return parseGatewayConfig(JSON.parse(raw));
    } catch {
      return structuredClone(DEFAULT_GATEWAY_CONFIG);
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return structuredClone(DEFAULT_GATEWAY_CONFIG);
  }
  const o = raw as Record<string, unknown>;
  return {
    gateways: sanitizeGateways(o.gateways),
    plans: sanitizePlans(o.plans),
    methods: sanitizeMethods(o.methods),
    checkoutUrls: sanitizeCheckoutUrls(o.checkoutUrls),
  };
}

export async function getGatewayConfig(): Promise<GatewayConfig> {
  try {
    const row = (await settings.systemSetting.findUnique({
      where: { key: GATEWAY_SETTING_KEY },
    })) as unknown as { value: string | null } | null;
    if (!row || row.value == null) return structuredClone(DEFAULT_GATEWAY_CONFIG);
    return parseGatewayConfig(row.value);
  } catch {
    return structuredClone(DEFAULT_GATEWAY_CONFIG);
  }
}

export async function saveGatewayConfig(raw: unknown): Promise<GatewayConfig> {
  const normalized = parseGatewayConfig(raw);
  const value = JSON.stringify(normalized);
  await settings.systemSetting.upsert({
    where: { key: GATEWAY_SETTING_KEY },
    create: { key: GATEWAY_SETTING_KEY, value },
    update: { value },
  });
  return normalized;
}

export function isGatewayAvailableSync(gatewayId: GatewayId, config?: GatewayConfig): boolean {
  if (gatewayId === "asaas") {
    try {
      return isAsaasEnvConfigured(getAsaasConfig());
    } catch {
      return false;
    }
  }
  if (gatewayId === "kiwify" || gatewayId === "kacto") {
    return false;
  }
  return false;
}

export async function isGatewayAvailable(gatewayId: string): Promise<boolean> {
  if (gatewayId !== "asaas" && gatewayId !== "kiwify" && gatewayId !== "kacto") return false;
  if ((gatewayId as GatewayId) === "asaas") {
    try {
      return isAsaasEnvConfigured(getAsaasConfig());
    } catch {
      return false;
    }
  }
  return false;
}

export function gatewaysForPlan(slug: string, config: GatewayConfig): string[] {
  if (!VALID_SLUG_SET.has(slug as string)) return [];
  const list = (config.plans as Record<string, string[]>)[slug];
  if (!Array.isArray(list)) return ["asaas"];
  return list;
}

export function gatewayAvailabilityMap(config: GatewayConfig): Record<GatewayId, boolean> {
  return {
    asaas: isGatewayAvailableSync("asaas", config),
    kiwify: false,
    kacto: false,
  };
}
