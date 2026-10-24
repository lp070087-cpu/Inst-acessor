import { withAdminApi } from "@/lib/auth/admin-api";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { getPromoConfig, savePromoConfig } from "@/lib/billing/promo-db";
import { PLAN_CATALOG, isLegacyPlan } from "@/lib/billing/plans/catalog";
import {
  DEFAULT_PROMO,
  describeCountdown,
  parsePromoConfig,
  planPromoDisplay,
  promoEntryFor,
  promoValidationError,
} from "@/lib/billing/promo";
import { appendAudit } from "@/lib/billing/plans/audit-db";
import { formatBRL } from "@/lib/billing/plans/display";

export const dynamic = "force-dynamic";

/**
 * CONFIGURAÇÃO DA PRÉ-VENDA (PARTES 17–19) — somente ADMIN
 * ========================================================
 *
 * GET  /api/admin/promo → config atual + prévia do que os cards mostram
 * POST /api/admin/promo → grava a config (normalizada no servidor)
 *
 * Cobertura ATUAL: os OITO slugs do catálogo (6 vendáveis + 2 legados). Cada
 * plano tem sua própria entrada no mapa unificado `config.plans`, com
 * liga/desliga individual, preço promocional e quantas cobranças levam o
 * desconto.
 *
 * Persistência: model `SystemSetting` (JÁ EXISTE no schema) com a key
 * `billing.promo.v1`. Nenhuma migration, nenhuma coluna nova.
 *
 * REGRA CENTRAL: esta rota é a ÚNICA forma de mudar a promoção, e ela só é
 * acessível ao ADMIN. O valor cobrado continua sendo decidido no
 * `startPublicCheckout` a partir desta config — nunca a partir do navegador.
 */

/**
 * Prévia do efeito em CADA card (preço cheio, promo, desconto, rótulo, condição).
 *
 * O preço cheio vem do CATÁLOGO OFICIAL (`PLAN_CATALOG`), nunca de números
 * repetidos aqui: se o catálogo mudar, a prévia do admin acompanha sozinha e
 * não existe uma segunda tabela de preços para sair de sincronia.
 *
 * Devolvemos também a ENTRADA gravada (`entry`) e metadados do plano (legado,
 * tipo) para o cliente conseguir editar cada slug sem reimplementar regra.
 */
function previewFor(config: ReturnType<typeof parsePromoConfig>, now: string) {
  return PLAN_CATALOG.map((plan) => {
    const d = planPromoDisplay({
      slug: plan.slug,
      basePriceCents: plan.priceCents,
      config,
      now,
    });
    const entry = promoEntryFor(config, plan.slug);
    return {
      slug: plan.slug,
      name: plan.name,
      legacy: isLegacyPlan(plan.slug),
      type: plan.type,
      billingInterval: plan.billingInterval,
      basePriceCents: d.basePriceCents,
      promoPriceCents: d.promoPriceCents,
      discountCents: d.discountCents,
      discountPercent: d.discountPercent,
      label: d.label,
      qualifier: d.qualifier,
      afterText: d.afterText,
      showPromo: d.showPromo,
      // Entrada configurada pelo admin (o que ele edita).
      entry,
    };
  });
}

async function GETHandler() {
  await requireAdminSession();
  try {
    const config = await getPromoConfig();
    const now = new Date().toISOString();
    return NextResponse.json({
      config,
      defaults: DEFAULT_PROMO,
      preview: previewFor(config, now),
      countdown: describeCountdown(config.countdown.endsAt, now),
      now,
    });
  } catch {
    console.error("[admin-promo] falha ao ler a configuração da pré-venda");
    return NextResponse.json(
      { error: "Não foi possível ler a configuração da pré-venda." },
      { status: 500 }
    );
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

  // A config chega crua; `savePromoConfig` normaliza campo a campo e devolve o
  // que REALMENTE ficou gravado. Um payload hostil (preço promocional acima do
  // cheio, `enabled` como string, countdown sem data válida) é normalizado —
  // nunca gravado como veio. O admin recebe de volta o que passou a valer.
  const raw = (body as { config?: unknown })?.config ?? body;

  // 1) Normaliza (o mapa `plans` é derivado dos campos legados quando ausente).
  const normalized = parsePromoConfig(raw);

  // 2) RECUSA anunciar um "desconto" que não é desconto: preço promocional ≥
  //    cheio em plano LIGADO. Antes era só normalizado (silencioso); agora o
  //    admin recebe o motivo e a gravação não acontece com dado enganoso.
  const validationError = promoValidationError(normalized);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const before = await getPromoConfig();
    const saved = await savePromoConfig(normalized);
    const now = new Date().toISOString();

    // Auditoria: quais planos tiveram a pré-venda alterada (antes → depois).
    const touched = new Set([
      ...Object.keys(before.plans),
      ...Object.keys(saved.plans),
    ]);
    const actor = session.user?.email ?? "admin";
    for (const slug of touched) {
      const prev = promoEntryFor(before, slug);
      const next = promoEntryFor(saved, slug);
      const changed =
        prev.enabled !== next.enabled ||
        prev.promoPriceCents !== next.promoPriceCents ||
        prev.chargesAtPromoPrice !== next.chargesAtPromoPrice ||
        prev.requiresNoPreviousPurchase !== next.requiresNoPreviousPurchase;
      if (!changed) continue;
      const desc = next.enabled
        ? `${formatBRL(next.promoPriceCents)}` +
          (next.chargesAtPromoPrice != null
            ? ` em ${next.chargesAtPromoPrice} cobrança(s)`
            : " (1ª cobrança)")
        : "desligada";
      await appendAudit({
        actor,
        action: "promo.update",
        slug,
        summary: `Pré-venda do plano ${slug}: ${desc}.`,
        before: prev,
        after: next,
      });
    }
    if (before.enabled !== saved.enabled) {
      await appendAudit({
        actor,
        action: "promo.update",
        slug: null,
        summary: `Chave geral da pré-venda ${saved.enabled ? "ligada" : "desligada"}.`,
        before: { enabled: before.enabled },
        after: { enabled: saved.enabled },
      });
    }

    return NextResponse.json({
      ok: true,
      config: saved,
      preview: previewFor(saved, now),
      countdown: describeCountdown(saved.countdown.endsAt, now),
      now,
    });
  } catch {
    console.error("[admin-promo] falha ao gravar a configuração da pré-venda");
    return NextResponse.json(
      { error: "Não foi possível salvar a configuração da pré-venda." },
      { status: 500 }
    );
  }
}

export const GET = withAdminApi(GETHandler);

export const POST = withAdminApi(POSTHandler);
