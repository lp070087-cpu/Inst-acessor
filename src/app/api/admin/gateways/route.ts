import { withAdminApi } from "@/lib/auth/admin-api";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { appendAudit } from "@/lib/billing/plans/audit-db";
import {
  ALL_GATEWAYS,
  GATEWAY_SETTING_KEY,
  getGatewayConfig,
  saveGatewayConfig,
  isGatewayAvailable,
  gatewayAvailabilityMap,
  type GatewayId,
  type GatewayConfig,
} from "@/lib/billing/gateways/config";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";

export const dynamic = "force-dynamic";

function isGatewayId(v: unknown): v is GatewayId {
  return typeof v === "string" && (ALL_GATEWAYS as string[]).includes(v);
}

async function GETHandler() {
  await requireAdminSession();
  try {
    const config = await getGatewayConfig();
    const availability = gatewayAvailabilityMap(config);
    return NextResponse.json({ config, availability, key: GATEWAY_SETTING_KEY });
  } catch {
    console.error("[admin-gateways] falha ao ler config");
    return NextResponse.json({ error: "Não foi possível ler a configuração de gateways." }, { status: 500 });
  }
}

async function POSTHandler(request: Request) {
  const { session } = await requireAdminSession();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action;
  const actor = session.user?.email ?? "admin";

  // Carrega config atual para patches
  let current: GatewayConfig;
  try {
    current = await getGatewayConfig();
  } catch {
    return NextResponse.json({ error: "Não foi possível ler a configuração atual." }, { status: 500 });
  }

  // ------------------------------------------------ toggle-gateway
  if (action === "toggle-gateway") {
    const gateway = b.gateway;
    const enabled = b.enabled;
    if (!isGatewayId(gateway) || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Informe { gateway: asaas|kiwify|kacto, enabled: boolean }." }, { status: 400 });
    }
    if (enabled) {
      const available = await isGatewayAvailable(gateway);
      if (!available) {
        return NextResponse.json({ error: "Configure credenciais antes de ativar" }, { status: 400 });
      }
    }
    const next: GatewayConfig = {
      ...current,
      gateways: {
        ...current.gateways,
        [gateway]: { ...current.gateways[gateway as GatewayId], enabled },
      },
    };
    try {
      const saved = await saveGatewayConfig(next);
      await appendAudit({
        actor,
        action: "plan.active" as unknown as "promo.update",
        slug: null,
        summary: `${enabled ? "Ativou" : "Desativou"} gateway ${gateway}.`,
        before: { gateway, enabled: current.gateways[gateway as GatewayId]?.enabled },
        after: { gateway, enabled },
      }).catch(() => {});
      const availability = gatewayAvailabilityMap(saved);
      return NextResponse.json({ ok: true, config: saved, availability });
    } catch (err) {
      console.error("[admin-gateways] falha ao salvar toggle", err);
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }
  }

  // ------------------------------------------------ set-plan-gateways
  if (action === "set-plan-gateways") {
    const plan = b.plan;
    const gateways = b.gateways;
    if (typeof plan !== "string" || !Array.isArray(gateways)) {
      return NextResponse.json({ error: "Informe { plan: slug, gateways: string[] }." }, { status: 400 });
    }
    const validSlugs = new Set(PLAN_CATALOG.map((p) => p.slug) as string[]);
    if (!validSlugs.has(plan as string)) {
      return NextResponse.json({ error: "Plano desconhecido." }, { status: 404 });
    }
    const normalized: string[] = [...new Set(gateways.filter((g): g is GatewayId => isGatewayId(g)))];
    if (normalized.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um gateway válido." }, { status: 400 });
    }
    const before = (current.plans as Record<string, string[]>)[plan as string] ?? [];
    const next: GatewayConfig = {
      ...current,
      plans: { ...(current.plans as Record<string, string[]>), [plan as string]: normalized } as unknown as GatewayConfig["plans"],
    };
    try {
      const saved = await saveGatewayConfig(next);
      await appendAudit({
        actor,
        action: "plan.active" as unknown as "promo.update",
        slug: plan,
        summary: `Gateways do plano ${plan}: ${before.join(",") || "—"} → ${normalized.join(",")}.`,
        before: { plan, gateways: before },
        after: { plan, gateways: normalized },
      }).catch(() => {});
      const availability = gatewayAvailabilityMap(saved);
      return NextResponse.json({ ok: true, config: saved, availability });
    } catch (err) {
      console.error("[admin-gateways] falha ao salvar plan gateways", err);
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }
  }

  // ------------------------------------------------ set-methods
  if (action === "set-methods") {
    const methods = b.methods;
    if (!methods || typeof methods !== "object" || Array.isArray(methods)) {
      return NextResponse.json({ error: "Informe { methods: { pix, card, boleto } }." }, { status: 400 });
    }
    const m = methods as Record<string, unknown>;
    const nextMethods = { ...current.methods };
    for (const k of ["pix", "card", "boleto"] as const) {
      if (typeof m[k] === "boolean") nextMethods[k] = m[k] as boolean;
    }
    const next: GatewayConfig = { ...current, methods: nextMethods };
    try {
      const saved = await saveGatewayConfig(next);
      await appendAudit({
        actor,
        action: "plan.active" as unknown as "promo.update",
        slug: null,
        summary: `Métodos de pagamento: pix=${String(nextMethods.pix)} card=${String(nextMethods.card)} boleto=${String(nextMethods.boleto)}.`,
        before: current.methods,
        after: nextMethods,
      }).catch(() => {});
      const availability = gatewayAvailabilityMap(saved);
      return NextResponse.json({ ok: true, config: saved, availability });
    } catch (err) {
      console.error("[admin-gateways] falha ao salvar methods", err);
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }
  }

  // ------------------------------------------------ set-checkout-url
  if (action === "set-checkout-url") {
    const plan = b.plan;
    const checkoutUrl = b.checkoutUrl;
    if (typeof plan !== "string") {
      return NextResponse.json({ error: "Informe { plan, checkoutUrl }." }, { status: 400 });
    }
    const validSlugs2 = new Set(PLAN_CATALOG.map((p) => p.slug) as string[]);
    if (!validSlugs2.has(plan as string)) {
      return NextResponse.json({ error: "Plano desconhecido." }, { status: 404 });
    }
    // checkoutUrl pode ser "" para limpar.
    // Segurança: usado como REDIRECT target → exige https://, max 500 chars.
    let urlValue: string | null = null;
    if (typeof checkoutUrl === "string" && checkoutUrl.trim()) {
      const raw = checkoutUrl.trim();
      if (raw.length > 500) {
        return NextResponse.json({ error: "URL muito longa (max 500 caracteres)." }, { status: 400 });
      }
      try {
        const u = new URL(raw);
        if (u.protocol !== "https:") {
          return NextResponse.json({ error: "URL de checkout deve usar https://." }, { status: 400 });
        }
        urlValue = raw;
      } catch {
        return NextResponse.json({ error: "URL de checkout inválida. Use https://..." }, { status: 400 });
      }
    }
    const nextCheckoutUrls = { ...(current.checkoutUrls as Record<string, string>) };
    if (urlValue) nextCheckoutUrls[plan as string] = urlValue;
    else delete nextCheckoutUrls[plan as string];

    const next: GatewayConfig = { ...current, checkoutUrls: nextCheckoutUrls };
    try {
      const saved = await saveGatewayConfig(next);
      await appendAudit({
        actor,
        action: "plan.active" as unknown as "promo.update",
        slug: plan,
        summary: urlValue ? `Checkout externo de ${plan}: ${urlValue}` : `Checkout externo de ${plan} removido.`,
        before: { plan, checkoutUrl: (current.checkoutUrls as Record<string, string>)[plan as string] ?? null },
        after: { plan: plan as string, checkoutUrl: urlValue },
      }).catch(() => {});
      const availability = gatewayAvailabilityMap(saved);
      return NextResponse.json({ ok: true, config: saved, availability });
    } catch (err) {
      console.error("[admin-gateways] falha ao salvar checkout-url", err);
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Ação desconhecida. Use toggle-gateway | set-plan-gateways | set-methods | set-checkout-url." },
    { status: 400 }
  );
}

export const GET = withAdminApi(GETHandler);

export const POST = withAdminApi(POSTHandler);
