import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { PLAN_CATALOG, isLegacyPlan } from "@/lib/billing/plans/catalog";
import { LIMITS_ENFORCEMENT_ENABLED } from "@/lib/billing/plans/limits";
import {
  QUOTA_FIELDS,
  QUOTA_FIELD_LABELS,
  quotasWithDefaults,
  getQuotaOverrides,
  saveQuotaOverrides,
  type QuotaField,
} from "@/lib/billing/plans/limits-db";
import {
  effectiveActivation,
  setPlanActive,
} from "@/lib/billing/plans/activation-db";
import { appendAudit, readAuditLog } from "@/lib/billing/plans/audit-db";

export const dynamic = "force-dynamic";

/**
 * ADMIN — PLANOS (ativação comercial + franquias)
 * ===============================================
 * GET  /api/admin/plans → catálogo completo (8 planos), estado efetivo de
 *                         ativação, franquias (padrão + efetivo), auditoria.
 * POST /api/admin/plans → ações do proprietário:
 *   { action: "set-active", slug, active }  → liga/desliga a VENDA de um plano
 *   { action: "save-limits", overrides }    → grava overrides de franquia
 *
 * Persistência: `SystemSetting` (JÁ EXISTE) + espelho em `Plan.active`.
 * Nenhuma migration. Valores de franquia são inteiros (ou `null` = sem teto).
 *
 * GUARDADO por `requireAdminSession` (e-mail do admin, checado no servidor).
 */

/** Uma ação de ativação válida? */
function isActiveAction(v: unknown): v is { slug: string; active: boolean } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.slug === "string" && typeof o.active === "boolean";
}

export async function GET() {
  await requireAdminSession();
  try {
    const [activation, overrides, audit] = await Promise.all([
      effectiveActivation(),
      getQuotaOverrides(),
      readAuditLog(),
    ]);
    const quotaMap = quotasWithDefaults(overrides);

    const plans = PLAN_CATALOG.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
      type: p.type,
      billingInterval: p.billingInterval,
      durationDays: p.durationDays,
      sortOrder: p.sortOrder,
      legacy: isLegacyPlan(p.slug),
      /** `active` do catálogo (padrão inicial) — para exibir "padrão vs efetivo". */
      catalogActive: p.active,
      /** `active` EFETIVO (o que vale para a venda agora). */
      active: activation[p.slug] ?? p.active,
      quotas: quotaMap[p.slug] ?? null,
    }));

    return NextResponse.json({
      plans,
      limitsEnforcementEnabled: LIMITS_ENFORCEMENT_ENABLED,
      quotaFields: QUOTA_FIELDS.map((f) => ({ field: f, label: QUOTA_FIELD_LABELS[f] })),
      audit,
    });
  } catch {
    console.error("[admin-plans] falha ao ler o catálogo/ativação");
    return NextResponse.json(
      { error: "Não foi possível ler os planos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { session } = await requireAdminSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const actor = session.user?.email ?? "admin";
  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action;

  // -------------------------------------------------------------- ATIVAR/DESATIVAR
  if (action === "set-active") {
    if (!isActiveAction(b)) {
      return NextResponse.json(
        { error: "Ação inválida: informe { slug, active }." },
        { status: 400 }
      );
    }
    const catalogPlan = PLAN_CATALOG.find((p) => p.slug === b.slug);
    if (!catalogPlan) {
      return NextResponse.json({ error: "Plano desconhecido." }, { status: 404 });
    }
    try {
      const before = await effectiveActivation();
      const result = await setPlanActive(b.slug, b.active);
      await appendAudit({
        actor,
        action: "plan.active",
        slug: b.slug,
        summary:
          `${b.active ? "Ativou" : "Desativou"} a venda do plano ` +
          `${catalogPlan.name} (${b.slug}).`,
        before: { active: before[b.slug] ?? catalogPlan.active },
        after: { active: b.active },
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      console.error("[admin-plans] falha ao mudar ativação", err);
      return NextResponse.json(
        { error: "Não foi possível alterar a ativação do plano." },
        { status: 500 }
      );
    }
  }

  // -------------------------------------------------------------- SALVAR FRANQUIAS
  if (action === "save-limits") {
    const raw = b.overrides;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Overrides inválidos: informe um objeto por slug." },
        { status: 400 }
      );
    }

    // Validação EXPLÍCITA (não só normalização): um valor negativo ou não-inteiro
    // é recusado com mensagem, em vez de virar "sem teto" silenciosamente.
    const o = raw as Record<string, unknown>;
    for (const slug of Object.keys(o)) {
      const entry = o[slug];
      if (entry == null) continue;
      if (typeof entry !== "object" || Array.isArray(entry)) {
        return NextResponse.json(
          { error: `Franquia do plano "${slug}" inválida.` },
          { status: 400 }
        );
      }
      const e = entry as Record<string, unknown>;
      for (const f of Object.keys(e)) {
        if (!(QUOTA_FIELDS as readonly string[]).includes(f)) {
          return NextResponse.json(
            { error: `Campo de franquia desconhecido: "${f}".` },
            { status: 400 }
          );
        }
        const v = e[f];
        if (v === null) continue;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
          return NextResponse.json(
            {
              error:
                `Valor inválido para "${QUOTA_FIELD_LABELS[f as QuotaField] ?? f}": ` +
                "use inteiro ≥ 0 ou deixe vazio para sem teto.",
            },
            { status: 400 }
          );
        }
      }
    }

    try {
      const before = await getQuotaOverrides();
      const saved = await saveQuotaOverrides(raw);
      // Auditoria por slug alterado (antes → depois), sem poluir o log.
      const touched = new Set([...Object.keys(before), ...Object.keys(saved)]);
      for (const slug of touched) {
        const prev = before[slug] ?? {};
        const next = saved[slug] ?? {};
        const changed = QUOTA_FIELDS.filter(
          (f) => (prev as Record<string, unknown>)[f] !== (next as Record<string, unknown>)[f]
        );
        if (changed.length === 0) continue;
        await appendAudit({
          actor,
          action: "plan.limits",
          slug,
          summary:
            `Ajustou franquias de ${slug}: ` +
            changed
              .map((f) => `${QUOTA_FIELD_LABELS[f]} ${String((prev as Record<string, unknown>)[f] ?? "—")} → ${String((next as Record<string, unknown>)[f] ?? "—")}`)
              .join("; ") +
            ".",
          before: prev,
          after: next,
        });
      }

      const quotaMap = quotasWithDefaults(saved);
      return NextResponse.json({ ok: true, overrides: saved, quotas: quotaMap });
    } catch (err) {
      console.error("[admin-plans] falha ao salvar franquias", err);
      return NextResponse.json(
        { error: "Não foi possível salvar as franquias." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Ação desconhecida. Use 'set-active' ou 'save-limits'." },
    { status: 400 }
  );
}
