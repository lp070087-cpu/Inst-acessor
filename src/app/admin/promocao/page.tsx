import type { Metadata } from "next";
import { Tag } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getPromoConfig } from "@/lib/billing/promo-db";
import { DEFAULT_PROMO, describeCountdown } from "@/lib/billing/promo";
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
 * Cobre os OITO slugs do catálogo (6 vendáveis + 2 legados) via o mapa unificado
 * `config.plans`. A prévia de cada plano é calculada no cliente com a MESMA
 * função pura que o checkout usa (`planPromoDisplay`) — o que o admin vê é
 * exatamente o que o cliente verá.
 */
export default async function AdminPromoPage() {
  await requireAdminSession();

  const config = await getPromoConfig();
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Tag size={26} className="text-purple" />
          Pré-venda
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Configuração da promoção de lançamento e do countdown, plano a plano. O
          preço cobrado é decidido pelo servidor a partir daqui — nunca pelo
          navegador.
        </p>
      </div>

      <AdminPromoClient
        initialConfig={config}
        initialCountdown={describeCountdown(config.countdown.endsAt, now)}
        defaultConfig={DEFAULT_PROMO}
      />
    </div>
  );
}
