import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { PLAN_CATALOG, isLegacyPlan } from "@/lib/billing/plans/catalog";
import { LIMITS_ENFORCEMENT_ENABLED } from "@/lib/billing/plans/limits";
import {
  QUOTA_FIELDS,
  QUOTA_FIELD_LABELS,
  quotasWithDefaults,
  getQuotaOverrides,
  type QuotaField,
} from "@/lib/billing/plans/limits-db";
import { effectiveActivation } from "@/lib/billing/plans/activation-db";
import { readAuditLog } from "@/lib/billing/plans/audit-db";
import {
  AdminPlansClient,
  type AdminPlanRow,
} from "@/components/admin/admin-plans-client";

export const metadata: Metadata = {
  title: "Planos — Inst Acessor",
  description: "Catálogo, ativação comercial e franquias dos planos (administração).",
};

export const dynamic = "force-dynamic";

/**
 * PLANOS — PAINEL DO ADMIN
 * ========================
 * Lê o CATÁLOGO OFICIAL (fonte de verdade de preços/preços em centavos) e mostra
 * o estado EFETIVO de cada plano: ligado/desligado para venda (override do
 * proprietário) e a franquia vigente (padrão em código + override do admin).
 *
 * Esta tela NÃO reescreve código: a edição de franquia vira um OVERRIDE gravado
 * em `SystemSetting`; a ativação vira um override + espelho em `Plan.active`.
 * Nada aqui altera retroativamente um contrato vigente — a própria tela avisa.
 */
export default async function AdminPlansPage() {
  await requireAdminSession();

  const [activation, overrides, audit] = await Promise.all([
    effectiveActivation(),
    getQuotaOverrides(),
    readAuditLog(),
  ]);
  const quotaMap = quotasWithDefaults(overrides);

  const plans: AdminPlanRow[] = PLAN_CATALOG.map((p) => {
    const q = quotaMap[p.slug];
    return {
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      type: p.type,
      billingInterval: p.billingInterval,
      durationDays: p.durationDays,
      sortOrder: p.sortOrder,
      legacy: isLegacyPlan(p.slug),
      catalogActive: p.active,
      active: activation[p.slug] ?? p.active,
      quotas: {
        effective: q?.effective ?? {
          aiPerDay: null,
          aiPerCycle: null,
          autoRepliesPerCycle: null,
          profileAnalysisPerCycle: null,
          publicationsPerCycle: null,
          activeAutomationRules: null,
          connectedAccounts: null,
        },
        default: q?.default ?? null,
        overridden: q?.overridden ?? [],
      },
    };
  });

  const quotaFields = QUOTA_FIELDS.map((f) => ({
    field: f as QuotaField,
    label: QUOTA_FIELD_LABELS[f],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Layers size={26} className="text-purple" />
          Planos
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Catálogo comercial, liga/desliga de venda e franquias por plano. Valores
          em centavos inteiros. As mudanças valem para NOVAS vendas — contratos
          vigentes não são alterados.
        </p>
      </div>

      <AdminPlansClient
        initialPlans={plans}
        quotaFields={quotaFields}
        limitsEnforcementEnabled={LIMITS_ENFORCEMENT_ENABLED}
        initialAudit={audit}
      />
    </div>
  );
}
