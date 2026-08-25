import type { Metadata } from "next";
import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Seus dados e preferências.",
};

export default async function PerfilPage() {
  const { session, profile } = await requireOnboardedSession();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">Perfil</h1>
        <p className="text-[13.5px] text-ink-soft">
          Seus dados e preferências de conta.
        </p>
      </div>

      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <div className="flex items-center gap-4">
          <Avatar name={session.user.name} src={session.user.image} size="lg" />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-[18px] font-bold text-ink">
                {session.user.name ?? "Sem nome"}
              </h2>
              <Badge tone="brand">Inst Acessor</Badge>
            </div>
            <p className="text-[13px] text-ink-soft">{session.user.email}</p>
          </div>
        </div>

        <Divider className="my-6" label="Perfil" />

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Objetivo
            </dt>
            <dd className="text-[14.5px] text-ink mt-1">
              {profile?.objective ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Nicho
            </dt>
            <dd className="text-[14.5px] text-ink mt-1">{profile?.niche ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Subnicho
            </dt>
            <dd className="text-[14.5px] text-ink mt-1">
              {profile?.subNiche ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              Usuário
            </dt>
            <dd className="text-[14.5px] text-ink mt-1">
              {profile?.username ?? "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
