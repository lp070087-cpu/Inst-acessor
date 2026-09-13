import type { Metadata } from "next";
import { Users } from "lucide-react";

import { requireAdminSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { bll } from "@/lib/billing/db";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { AdminAccessGrant } from "@/components/admin/admin-access-grant";
import { AdminAccessGrantsTable } from "@/components/admin/admin-access-grants";

export const metadata: Metadata = {
  title: "Usuários — Inst Acessor",
  description: "Gerencie contas, papéis e status dos usuários.",
};

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

interface AccessGrantRow {
  id: string;
  email: string;
  planName: string | null;
  origin: string;
  status: string;
  startAt: Date | null;
  expiresAt: Date | null;
  firstAccessCompleted: boolean;
  firstAccessCompletedAt: Date | null;
  createdAt: Date;
}

export default async function AdminUsersPage() {
  const { session } = await requireAdminSession();
  const adminId = session.user.id;

  // E-mail do administrador oficial (fonte da verdade server-side).
  const adminUser = await prisma.user.findUnique({
    where: { id: adminId },
    select: { email: true },
  });
  const adminEmail = adminUser?.email ?? "";

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: {
        select: { subscriptions: true, connections: true },
      },
    },
  });

  // Liberações de acesso (primeiro acesso) — origem ASAAS ou ADMIN_MANUAL.
  const grants = (await bll.accessGrant.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })) as unknown as AccessGrantRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-ink flex items-center gap-2.5">
          <Users size={26} className="text-purple" />
          Usuários
        </h1>
        <p className="text-[13.5px] text-ink-soft mt-1">
          Contas, papéis e status. A autorização é sempre verificada no servidor.
        </p>
      </div>

      <AdminAccessGrant />

      <SectionCard
        title="Acessos liberados"
        description={`${grants.length} liberações (mais recentes primeiro). Origem: compra (Asaas) ou liberação manual.`}
      >
        <AdminAccessGrantsTable
          grants={grants.map((g) => ({
            id: g.id,
            email: g.email,
            planName: g.planName,
            origin: g.origin,
            status: g.status,
            startAt: g.startAt ? g.startAt.toISOString() : null,
            expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
            firstAccessCompleted: g.firstAccessCompleted,
            firstAccessCompletedAt: g.firstAccessCompletedAt
              ? g.firstAccessCompletedAt.toISOString()
              : null,
            createdAt: g.createdAt.toISOString(),
          }))}
        />
      </SectionCard>

      <SectionCard
        title="Todos os usuários"
        description={`${users.length} registros (mais recentes primeiro).`}
      >
        {users.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário ainda" description="Os cadastros aparecerão aqui." />
        ) : (
          <AdminUsersClient
            adminId={adminId}
            adminEmail={adminEmail}
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status,
              createdAt: fmtDate(u.createdAt),
              subscriptions: u._count.subscriptions,
              connections: u._count.connections,
            }))}
          />
        )}
      </SectionCard>
    </div>
  );
}
