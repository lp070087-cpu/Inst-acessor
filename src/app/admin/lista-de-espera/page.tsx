import type { Metadata } from "next";
import { UserCheck } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { getCapacityStatus } from "@/lib/billing/capacity-db";
import { DEFAULT_CAPACITY } from "@/lib/billing/capacity";
import {
  countWaitlistByStatus,
  listWaitlist,
  sweepExpiredInvites,
  waitlistAvailable,
  type WaitlistEntryRow,
} from "@/lib/billing/waitlist-db";
import { AdminCapacityClient } from "@/components/admin/admin-capacity-client";

export const metadata: Metadata = {
  title: "Capacidade e lista de espera — Inst Acessor",
  description: "Teto de clientes ativos e lista de espera (somente administração).",
};

export const dynamic = "force-dynamic";

/**
 * CAPACIDADE + LISTA DE ESPERA — painel do ADMIN
 * ================================================
 * A regra de vaga é decidida no SERVIDOR (`startPublicCheckout` →
 * `attemptCheckoutReservation`). Esta tela só edita a configuração e gerencia a
 * lista — nunca é ela que autoriza uma compra.
 */
export default async function AdminWaitlistPage() {
  await requireAdminSession();

  const available = waitlistAvailable();

  // Sem o model (migration não aplicada) a tela ainda abre, mostrando a
  // configuração — mas sem a lista, em vez de quebrar com 500.
  if (!available) {
    const status = await getCapacityStatus(null);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
            <UserCheck size={26} className="text-purple" />
            Capacidade e lista de espera
          </h1>
          <p className="text-[13.5px] text-ink-soft mt-1">
            Teto de clientes ativos e lista de espera pública.
          </p>
        </div>
        <AdminCapacityClient
          initialConfig={status.config}
          initialCounts={{ WAITING: 0, INVITED: 0, CONVERTED: 0, EXPIRED: 0 }}
          initialDecision={status.decision}
          defaultConfig={DEFAULT_CAPACITY}
          initialEntries={[]}
        />
      </div>
    );
  }

  // Saneia convites vencidos antes de exibir (o painel mostra o status efetivo).
  await sweepExpiredInvites();

  const [status, counts, rawEntries] = await Promise.all([
    getCapacityStatus(null),
    countWaitlistByStatus(),
    listWaitlist({ take: 200 }),
  ]);

  const entries = rawEntries.map((e: WaitlistEntryRow) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    status: e.status,
    invitedAt: e.invitedAt ? e.invitedAt.toISOString() : null,
    expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    convertedAt: e.convertedAt ? e.convertedAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <UserCheck size={26} className="text-purple" />
          Capacidade e lista de espera
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Teto de clientes ativos e lista de espera pública. A vaga é decidida no
          servidor — esta tela só configura e gerencia a fila.
        </p>
      </div>

      <AdminCapacityClient
        initialConfig={status.config}
        initialCounts={counts}
        initialDecision={status.decision}
        defaultConfig={DEFAULT_CAPACITY}
        initialEntries={entries}
      />
    </div>
  );
}
