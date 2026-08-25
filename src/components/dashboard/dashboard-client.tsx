"use client";

import { useState } from "react";

import { PlatformSelector, type PlatformId } from "./platform-selector";
import { MetricGrid } from "./metric-grid";
import { TikTokMetricGrid } from "./tiktok-metric-grid";
import type { DashboardInstagramData } from "@/lib/dashboard/instagram-data";
import type { TikTokDashboardData } from "@/lib/dashboard/tiktok-data";

interface DashboardClientProps {
  instagramData: DashboardInstagramData;
  tiktokData: TikTokDashboardData;
}

/**
 * Seletor de plataforma + grade correspondente.
 * Default: Instagram se conectado; senão TikTok se conectado; senão Instagram.
 */
export function DashboardClient({ instagramData, tiktokData }: DashboardClientProps) {
  const [platform, setPlatform] = useState<PlatformId>(() => {
    if (instagramData.connected) return "instagram";
    if (tiktokData.connected) return "tiktok";
    return "instagram";
  });

  return (
    <div className="flex flex-col gap-5">
      <PlatformSelector active={platform} onChange={setPlatform} />

      {platform === "instagram" ? (
        <MetricGrid data={instagramData} />
      ) : (
        <TikTokMetricGrid data={tiktokData} />
      )}
    </div>
  );
}
