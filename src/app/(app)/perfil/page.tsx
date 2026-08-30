import type { Metadata } from "next";
import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Divider } from "@/components/ui/divider";
import { PerfilClient } from "@/components/perfil/perfil-client";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Seus dados e preferências de conta.",
};

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const { session, profile } = await requireOnboardedSession();

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">Perfil</h1>
        <p className="text-[13.5px] text-ink-soft">
          Seus dados pessoais e preferências de conta.
        </p>
      </div>

      {/* Cabeçalho com avatar */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <div className="flex items-center gap-4">
          <Avatar
            name={session.user.name ?? userData?.name}
            src={session.user.image}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-[18px] font-bold text-ink">
                {session.user.name ?? userData?.name ?? "Sem nome"}
              </h2>
            </div>
            <p className="text-[13px] text-ink-soft">{userData?.email}</p>
          </div>
        </div>
      </div>

      {/* Formulário editável */}
      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <Divider className="mb-6" label="Dados do perfil" />
        <PerfilClient
          user={{ name: session.user.name ?? null, email: userData?.email ?? null }}
          profile={
            profile
              ? {
                  displayName: profile.displayName ?? null,
                  username: profile.username ?? null,
                  niche: profile.niche ?? null,
                  subNiche: profile.subNiche ?? null,
                  objective: profile.objective ?? null,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
