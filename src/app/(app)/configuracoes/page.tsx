import type { Metadata } from "next";
import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { Divider } from "@/components/ui/divider";
import { ConfiguracoesClient } from "@/components/configuracoes/configuracoes-client";

export const metadata: Metadata = {
  title: "Configurações",
  description: "Preferências da sua conta.",
};

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const { session } = await requireOnboardedSession();

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
    select: { locale: true, timezone: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">Configurações</h1>
        <p className="text-[13.5px] text-ink-soft">
          Preferências de idioma, fuso horário e dashboard.
        </p>
      </div>

      <div className="bg-card border border-border-soft rounded-lg shadow-xs p-6">
        <Divider className="mb-6" label="Preferências" />
        <ConfiguracoesClient
          initial={{
            locale: prefs?.locale ?? "pt-BR",
            timezone: prefs?.timezone ?? "America/Sao_Paulo",
          }}
        />
      </div>
    </div>
  );
}
