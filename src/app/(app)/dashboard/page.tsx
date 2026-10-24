import type { Metadata } from "next";
import Link from "next/link";
import { Instagram, Music2 } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";
import { getMediaProductionData } from "@/lib/dashboard/media-production";
import { buildDeterministicInsights } from "@/lib/dashboard/insights";
import { isAIConfigured } from "@/lib/ai";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { SyncMetricsButton } from "@/components/dashboard/sync-metrics-button";
import { AutoRefreshMetrics } from "@/components/dashboard/auto-refresh-metrics";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Visão geral das suas redes sociais.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session } = await requireOnboardedSession();

  // Dados reais em paralelo. A camada de IA só é CONSULTADA (booleano) —
  // nenhuma chamada é feita aqui, e nenhuma chave sai do servidor.
  const [instagramData, tiktokData, mediaData, aiReady] = await Promise.all([
    getDashboardInstagramData(session.user.id),
    getTikTokDashboardData(session.user.id),
    getMediaProductionData(session.user.id),
    isAIConfigured(),
  ]);

  // Média REAL de interações por publicação, alimentando as métricas rápidas
  // e o Score. Sem publicações coletadas → permanece null (nunca 0).
  instagramData.comparison.avgEngagement = mediaData.avgInteractionsPerMedia;

  const insights = buildDeterministicInsights(instagramData, mediaData);

  const firstName = session.user.name?.trim().split(/\s+/)[0] ?? "";
  // Saudação ao usuário autenticado do Inst Acessor (nunca da conta social).
  const greeting = firstName ? `Olá, ${firstName}` : "Olá, bem-vindo(a)";

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title={greeting}
          description="Veja como suas redes sociais estão evoluindo."
          action={
            <>
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
            </>
          }
        />

        {/* Convite a conectar, SÓ quando não há conexão.
            O "Atualizar métricas" saiu daqui: ele pertence ao card da conta que
            atualiza, no rodapé do próprio card (ver `accountAction` abaixo). */}
        {(!instagramData.connected || !tiktokData.connected) && (
          <div className="flex flex-wrap items-center gap-2.5">
            {!instagramData.connected && (
              <Link
                href="/redes-sociais"
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                <Instagram size={16} />
                Conectar Instagram
              </Link>
            )}

            {!tiktokData.connected && (
              <Link
                href="/redes-sociais"
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                <Music2 size={16} />
                Conectar TikTok
              </Link>
            )}
          </div>
        )}
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

        {/* Atualização automática controlada: se o último sync passou do TTL
            (1h), sincroniza em segundo plano e recarrega. Os dados salvos já
            foram renderizados acima — isto nunca bloqueia a tela. O botão
            manual continua no rodapé do card da conta. */}
        <AutoRefreshMetrics connected={instagramData.connected} />

        <DashboardClient
          instagramData={instagramData}
          tiktokData={tiktokData}
          mediaData={mediaData}
          insights={insights}
          aiConfigured={aiReady}
          greeting={greeting}
          instagramAction={
            instagramData.connected ? (
              <SyncMetricsButton
                connected
                platform="instagram"
                lastSyncAt={instagramData.lastSyncAt?.toISOString() ?? null}
              />
            ) : null
          }
          tiktokAction={
            tiktokData.connected ? (
              <SyncMetricsButton
                connected
                platform="tiktok"
                lastSyncAt={tiktokData.lastSyncAt?.toISOString() ?? null}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
