import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getGatewayConfig, gatewayAvailabilityMap } from "@/lib/billing/gateways/config";
import { AdminGatewaysClient } from "@/components/admin/admin-gateways-client";

export const metadata: Metadata = {
  title: "Gateways — Inst Acessor",
  description: "Configuração de gateways de pagamento (Asaas oficial, Kiwify e Kacto configuráveis).",
};

export const dynamic = "force-dynamic";

export default async function AdminGatewaysPage() {
  await requireAdminSession();

  const config = await getGatewayConfig();
  const availability = gatewayAvailabilityMap(config);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <CreditCard size={26} className="text-purple" />
          Gateways
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Asaas é o gateway oficial. Kiwify e Kacto ficam inativos até haver credenciais documentadas.
          Defina por plano quais gateways podem cobrar e os métodos aceitos.
        </p>
      </div>

      <AdminGatewaysClient initialConfig={config} initialAvailability={availability} />
    </div>
  );
}
