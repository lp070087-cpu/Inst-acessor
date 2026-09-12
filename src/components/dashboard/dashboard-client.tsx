"use client";

import { useState } from "react";

import { PlatformSelector, type PlatformId } from "./platform-selector";
import { MetricGrid } from "./metric-grid";
import { TikTokMetricGrid } from "./tiktok-metric-grid";
import { ConnectedAccountCard } from "@/components/integrations/connected-account-card";
import type { DashboardInstagramData } from "@/lib/dashboard/instagram-data";
import type { TikTokDashboardData } from "@/lib/dashboard/tiktok-data";

interface DashboardClientProps {
  instagramData: DashboardInstagramData;
  tiktokData: TikTokDashboardData;
  /** Saudação ao usuário autenticado (ex.: "Olá, Lucas"). */
  greeting?: string | null;
}

/**
 * Seletor de plataforma + grade correspondente.
 * Default: Instagram se conectado; senão TikTok se conectado; senão Instagram.
 *
 * A identificação da conta acompanha a plataforma selecionada — nunca mistura
 * dados de Instagram com TikTok.
 */
export function DashboardClient({
  instagramData,
  tiktokData,
  greeting,
}: DashboardClientProps) {
  const [platform, setPlatform] = useState<PlatformId>(() => {
    if (instagramData.connected) return "instagram";
    if (tiktokData.connected) return "tiktok";
    return "instagram";
  });

  const active = platform === "instagram" ? instagramData : tiktokData;

  return (
    <div className="flex flex-col gap-5">
      <PlatformSelector active={platform} onChange={setPlatform} />

      {/* Identificação da conta conectada — dados reais da plataforma ativa. */}
      {active.connected && (
        <ConnectedAccountCard
          platform={platform}
          username={active.username}
          displayName={active.displayName}
          avatarUrl={active.avatarUrl}
          lastSyncAt={active.lastSyncAt ?? null}
          greeting={greeting}
        />
      )}

      {platform === "instagram" ? (
        <MetricGrid data={instagramData} />
      ) : (
        <TikTokMetricGrid data={tiktokData} />
      )}
    </div>
  );
}
