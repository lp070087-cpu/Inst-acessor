import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getDisplayNameInfo } from "@/lib/gamification";
import { describeSync } from "@/lib/dashboard/freshness";
import { getMySubscription } from "@/lib/billing";
import { effectiveConnectionStatus } from "@/lib/integrations/connection-status";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import {
  ConfiguracoesClient,
  type ConfigConnection,
} from "@/components/account/configuracoes-client";

export const metadata: Metadata = {
  title: "Configurações",
  description: "Preferências da sua conta e das suas integrações.",
};

// A identidade vem do BANCO (a sessão é JWT e congelaria valores no login).
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const [
    displayNameInfo,
    instagram,
    tiktok,
    oauthStates,
    preferences,
    subscription,
  ] = await Promise.all([
    // MESMA fonte que o Rank usa — nenhuma segunda implementação da preferência.
    getDisplayNameInfo(userId),
    prisma.socialConnection.findFirst({ where: { userId, platform: "instagram" } }),
    prisma.socialConnection.findFirst({ where: { userId, platform: "tiktok" } }),
    // Necessário para detectar um CONNECTING órfão (fluxo OAuth abandonado).
    prisma.oAuthState.findMany({
      where: { userId, consumed: false, expiresAt: { gt: new Date() } },
      select: { provider: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { locale: true, timezone: true },
    }),
    getMySubscription(userId),
  ]);

  const hasInstagramFlow = oauthStates.some((s) => s.provider === "instagram");
  const hasTikTokFlow = oauthStates.some((s) => s.provider === "tiktok");

  const build = (
    platform: "instagram" | "tiktok",
    connection: { status: string; username: string | null; lastSyncAt: Date | null } | null,
    hasFlow: boolean
  ): ConfigConnection => {
    const status = effectiveConnectionStatus(connection?.status, hasFlow);
    const connected = status === "CONNECTED";
    // Frescor vem de `describeSync` — a fonte única já usada no Dashboard.
    // `lastSyncAt` só é gravado por sincronização REAL: null = "Ainda não
    // sincronizado", nunca "0" nem "agora".
    const sync = describeSync(connection?.lastSyncAt ?? null);
    return {
      platform,
      status,
      connected,
      username: connection?.username ?? null,
      lastSyncLabel: sync.label,
      lastSyncDetail: sync.detail,
      lastSyncStale: sync.stale,
    };
  };

  const connections: ConfigConnection[] = [
    build("instagram", instagram, hasInstagramFlow),
    build("tiktok", tiktok, hasTikTokFlow),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-[13px] bg-ai-soft text-purple grid place-items-center flex-none">
          <Settings size={20} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold text-ink">Configurações</h1>
          <p className="text-[13.5px] text-ink-soft mt-1">
            Sua conta, suas integrações e o aplicativo.
          </p>
        </div>
      </div>

      <ConfiguracoesClient
        displayName={{
          storedSource: displayNameInfo.storedSource,
          source: displayNameInfo.source,
          value: displayNameInfo.value,
          hasInstagram: displayNameInfo.hasInstagram,
          igUsername: displayNameInfo.igUsername,
          profileName: displayNameInfo.profileName,
        }}
        connections={connections}
        subscription={{
          planName: subscription?.planName ?? null,
          status: subscription?.status ?? null,
          expiresAt: subscription?.expiresAt ?? null,
        }}
        preferences={{
          locale: preferences?.locale ?? "pt-BR",
          timezone: preferences?.timezone ?? "America/Sao_Paulo",
        }}
      />

      {/* PWA — instalação discreta e opcional. Nunca é um popup.
          Preservado exatamente como estava (manifest, service worker e
          beforeinstallprompt intactos). */}
      <InstallAppCard />
    </div>
  );
}
