import type { Metadata } from "next";
import { Tag } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getPromoConfig } from "@/lib/billing/promo-db";
import { PLAN_CATALOG } from "@/lib/billing/plans/catalog";
import { DEFAULT_PROMO, describeCountdown, planPromoDisplay } from "@/lib/billing/promo";
import { AdminPromoClient } from "@/components/admin/admin-promo-client";

export const metadata: Metadata = {
  title: "Pré-venda — Inst Acessor",
  description: "Configuração central da pré-venda e do countdown (somente administração).",
};

export const dynamic = "force-dynamic";

/**
 * PRÉ-VENDA (PARTES 17–19) — painel do ADMIN
 * ===========================================
 * O valor cobrado NÃO é definido aqui por acaso: o servidor lê esta configuração
 * em `startPublicCheckout` e é ele quem decide o preço. Esta tela só a edita.
 *
 * O que ela NÃO faz: inventar desconto. A prévia abaixo usa as MESMAS funções
 * puras que o checkout usa (`planPromoDisplay`), então o que o admin vê é
 * exatamente o que o cliente verá.
 */
export default async function AdminPromoPage() {
  await requireAdminSession();

  const config = await getPromoConfig();
  const now = new Date().toISOString();

  // O preço cheio vem do CATÁLOGO OFICIAL (`PLAN_CATALOG`), não de números
  // repetidos nesta tela: o que o admin vê é o mesmo preço que o checkout cobra.
  const preview = PLAN_CATALOG.map((plan) => {
    // `planPromoDisplay` devolve só os números do preço — o `slug` é acrescentado
    // aqui porque o cliente o usa como chave de renderização.
    return {
      slug: plan.slug,
      ...planPromoDisplay({ slug: plan.slug, basePriceCents: plan.priceCents, config, now }),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Tag size={26} className="text-purple" />
          Pré-venda
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Configuração da promoção de lançamento e do countdown. O preço cobrado é
          decidido pelo servidor a partir daqui — nunca pelo navegador.
        </p>
      </div>

      <AdminPromoClient
        initialConfig={config}
        initialPreview={preview}
        initialCountdown={describeCountdown(config.countdown.endsAt, now)}
        defaultConfig={DEFAULT_PROMO}
      />
    </div>
  );
}
