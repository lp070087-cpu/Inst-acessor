import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { getPromoConfig, savePromoConfig } from "@/lib/billing/promo-db";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import {
  DEFAULT_PROMO,
  describeCountdown,
  parsePromoConfig,
  planPromoDisplay,
} from "@/lib/billing/promo";

export const dynamic = "force-dynamic";

/**
 * CONFIGURAÇÃO DA PRÉ-VENDA (PARTES 17–19) — somente ADMIN
 * ========================================================
 *
 * GET  /api/admin/promo → config atual + prévia do que os cards mostram
 * POST /api/admin/promo → grava a config (normalizada no servidor)
 *
 * Persistência: model `SystemSetting` (JÁ EXISTE no schema) com a key
 * `billing.promo.v1`. Nenhuma migration, nenhuma coluna nova.
 *
 * REGRA CENTRAL: esta rota é a ÚNICA forma de mudar a promoção, e ela só é
 * acessível ao ADMIN. O valor cobrado continua sendo decidido no
 * `startPublicCheckout` a partir desta config — nunca a partir do navegador.
 */

/**
 * Prévia do efeito nos 3 cards (preço cheio, promo, desconto, rótulo).
 *
 * O preço cheio vem do CATÁLOGO OFICIAL (`PLAN_CATALOG`), nunca de números
 * repetidos aqui: se o catálogo mudar, a prévia do admin acompanha sozinha e
 * não existe uma segunda tabela de preços para sair de sincronia.
 */
function previewFor(config: ReturnType<typeof parsePromoConfig>, now: string) {
  return PLAN_CATALOG.map((plan) => {
    const d = planPromoDisplay({
      slug: plan.slug,
      basePriceCents: plan.priceCents,
      config,
      now,
    });
    return {
      slug: plan.slug,
      basePriceCents: d.basePriceCents,
      promoPriceCents: d.promoPriceCents,
      discountCents: d.discountCents,
      discountPercent: d.discountPercent,
      label: d.label,
      showPromo: d.showPromo,
    };
  });
}

export async function GET() {
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

export async function POST(request: Request) {
  await requireAdminSession();

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
  try {
    const saved = await savePromoConfig((body as { config?: unknown })?.config ?? body);
    const now = new Date().toISOString();
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
