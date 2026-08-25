import type { Metadata } from "next";
import Link from "next/link";
import { Instagram, Music2 } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { Badge } from "@/components/ui/badge";
import { SyncMetricsButton } from "@/components/dashboard/sync-metrics-button";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Visão geral das suas redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session } = await requireOnboardedSession();

  const [instagramData, tiktokData] = await Promise.all([
    getDashboardInstagramData(session.user.id),
    getTikTokDashboardData(session.user.id),
  ]);

  const firstName = session.user.name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-bold text-ink">
              Olá, {firstName || "bem-vindo(a)"}
            </h1>
            <p className="text-[13.5px] text-ink-soft mt-0.5">
              Veja como suas redes sociais estão evoluindo.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {instagramData.connected && (
              <Badge tone="success" dot>
                Instagram conectado
              </Badge>
            )}
            {tiktokData.connected && (
              <Badge tone="info" dot>
                TikTok conectado
              </Badge>
            )}
          </div>
        </div>

        {/* Botões de ação por plataforma */}
        <div className="flex flex-wrap items-center gap-2.5">
          {instagramData.connected ? (
            <SyncMetricsButton
              connected
              platform="instagram"
              lastSyncAt={instagramData.lastSyncAt?.toISOString() ?? null}
            />
          ) : (
            <Link
              href="/app/redes-sociais"
              className="inline-flex items-center gap-2 rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white text-[13.5px] font-semibold px-5 py-2.5 shadow-brand transition-all duration-300 hover:shadow-brand-lg hover:-translate-y-0.5 hover:bg-[position:100%_100%] cursor-pointer"
            >
              <Instagram size={16} />
              Conectar Instagram
            </Link>
          )}

          {tiktokData.connected ? (
            <SyncMetricsButton
              connected
              platform="tiktok"
              lastSyncAt={tiktokData.lastSyncAt?.toISOString() ?? null}
            />
          ) : (
            <Link
              href="/app/redes-sociais"
              className="inline-flex items-center gap-2 rounded-pill bg-[linear-gradient(115deg,#F43F8E_0%,#A855F7_45%,#6366F1_100%)] bg-[length:160%_160%] text-white text-[13.5px] font-semibold px-5 py-2.5 shadow-brand transition-all duration-300 hover:shadow-brand-lg hover:-translate-y-0.5 hover:bg-[position:100%_100%] cursor-pointer"
            >
              <Music2 size={16} />
              Conectar TikTok
            </Link>
          )}
        </div>
      </div>

      {/* Visão geral */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display text-[16px] font-bold text-ink">
            Visão geral
          </h2>
          {!instagramData.connected && !tiktokData.connected && (
            <p className="text-[12px] text-ink-muted">
              Conecte uma rede social para liberar as métricas
            </p>
          )}
        </div>

        <DashboardClient
          instagramData={instagramData}
          tiktokData={tiktokData}
        />
      </div>
    </div>
  );
}
