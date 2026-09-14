import type { Metadata } from "next";
import { Instagram, Music2, ShieldCheck, Info } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { InstagramActions } from "@/components/integrations/instagram-actions";
import { TikTokActions } from "@/components/integrations/tiktok-actions";
import { ConnectedAccountCard } from "@/components/integrations/connected-account-card";

export const metadata: Metadata = {
  title: "Redes Sociais",
  description: "Conecte e gerencie suas redes sociais.",
};

type PlatformConnection = {
  platform: "instagram" | "tiktok";
  status: string | null;
  username: string | null;
  /** Nome de exibição da conta (quando a plataforma devolve). */
  displayName: string | null;
  /** Avatar real da conta conectada. null → fallback com inicial. */
  avatarUrl: string | null;
  accountType: string | null;
  lastSyncAt: Date | null;
};

export default async function RedesSociaisPage() {
  const { session } = await requireOnboardedSession();

  const [instagram, tiktok, instagramProfile, tiktokProfile, oauthStates] =
    await Promise.all([
      prisma.socialConnection.findFirst({
        where: { userId: session.user.id, platform: "instagram" },
      }),
      prisma.socialConnection.findFirst({
        where: { userId: session.user.id, platform: "tiktok" },
      }),
      // Perfis sincronizados — fonte do avatar e do nome de exibição reais.
      prisma.instagramProfile.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { name: true, profilePictureUrl: true },
      }),
      prisma.tikTokProfile.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { displayName: true, avatarUrl: true },
      }),
      prisma.oAuthState.findMany({
        where: {
          userId: session.user.id,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        select: { provider: true, state: true },
      }),
    ]);

  // Proteção anti-travamento (bug crítico):
  // Se o status está CONNECTING mas NÃO existe um fluxo OAuth ativo e válido
  // (state não consumido, não expirado), é um CONNECTING órfão de um fluxo
  // interrompido — trata como DISCONNECTED para nunca prender o botão.
  const hasActiveInstagramFlow = oauthStates.some((s) => s.provider === "instagram");
  const hasActiveTikTokFlow = oauthStates.some((s) => s.provider === "tiktok");

  const effectiveStatus = (status: string | null | undefined, hasActiveFlow: boolean) => {
    if (status === "CONNECTING" && !hasActiveFlow) return "DISCONNECTED";
    return (status ?? "DISCONNECTED") as "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR";
  };

  const instagramStatus = effectiveStatus(instagram?.status, hasActiveInstagramFlow);
  const tiktokStatus = effectiveStatus(tiktok?.status, hasActiveTikTokFlow);

  const instagramConnected = instagramStatus === "CONNECTED";
  const tiktokConnected = tiktokStatus === "CONNECTED";

  // Início do fluxo CONNECTING (para o botão não ficar preso se a Meta não
  // devolver o usuário ao nosso callback — ver InstagramActions).
  const instagramConnectingSince =
    instagramStatus === "CONNECTING" ? (instagram?.updatedAt?.toISOString() ?? null) : null;

  const tiktokConnectingSince =
    tiktokStatus === "CONNECTING" ? (tiktok?.updatedAt?.toISOString() ?? null) : null;

  const cards: PlatformConnection[] = [
    {
      platform: "instagram",
      status: instagramStatus,
      username: instagram?.username ?? null,
      displayName: instagramProfile?.name ?? null,
      avatarUrl: instagramProfile?.profilePictureUrl ?? null,
      accountType: instagram?.accountType ?? null,
      lastSyncAt: instagram?.lastSyncAt ?? null,
    },
    {
      platform: "tiktok",
      status: tiktokStatus,
      username: tiktok?.username ?? null,
      displayName: tiktokProfile?.displayName ?? null,
      avatarUrl: tiktokProfile?.avatarUrl ?? null,
      accountType: tiktok?.accountType ?? null,
      lastSyncAt: tiktok?.lastSyncAt ?? null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">Redes Sociais</h1>
        <p className="text-[13.5px] text-ink-soft">
          Conecte suas redes sociais para liberar métricas e estratégias.
        </p>
      </div>

      {/* Cards por plataforma */}
      <div className="flex flex-col gap-6">
        {cards.map((card) => {
          const connected =
            card.platform === "instagram" ? instagramConnected : tiktokConnected;
          const Icon = card.platform === "instagram" ? Instagram : Music2;
          const platformLabel = card.platform === "instagram" ? "Instagram" : "TikTok";

          return (
            <div
              key={card.platform}
              className="bg-card border border-border-soft rounded-lg shadow-xs p-6"
            >
              {connected ? (
                <>
                  {/* Identificação da conta conectada — MESMO padrão do Dashboard.
                      Avatar real, @username da conta social, rede, status e última
                      sincronização. Sem foto → fallback com a inicial do @. */}
                  <ConnectedAccountCard
                    platform={card.platform}
                    username={card.username}
                    displayName={card.displayName}
                    avatarUrl={card.avatarUrl}
                    lastSyncAt={card.lastSyncAt}
                  />

                  <div className="mt-5">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                      Tipo de conta
                    </p>
                    <p className="mt-1 text-[13.5px] text-ink font-medium">
                      {card.platform === "instagram"
                        ? card.accountType === "BUSINESS"
                          ? "Profissional (Business)"
                          : card.accountType === "CREATOR"
                            ? "Profissional (Creator)"
                            : card.accountType === "PROFESSIONAL"
                              ? "Profissional"
                              : card.accountType ?? "—"
                        : card.accountType === "BUSINESS"
                          ? "Conta Business"
                          : card.accountType ?? "—"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-4 flex-wrap">
                  <span className="w-12 h-12 rounded-[14px] bg-ai-soft text-purple grid place-items-center flex-none">
                    <Icon size={22} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="font-display text-[17px] font-bold text-ink">
                        {platformLabel}
                      </h2>
                      <StatusBadge status={card.status ?? "DISCONNECTED"} />
                    </div>

                    <p className="text-[13px] text-ink-soft mt-1">
                      {card.platform === "instagram"
                        ? "Conecte seu perfil profissional para acompanhar seguidores, engajamento, alcance e muito mais."
                        : "Conecte seu perfil para acompanhar seguidores, curtidas, vídeos e muito mais."}
                    </p>
                  </div>
                </div>
              )}

              <Divider className="my-5" />

              {card.platform === "instagram" ? (
                <InstagramActions
                  connected={instagramConnected}
                  status={instagramStatus}
                  connectingSince={instagramConnectingSince}
                />
              ) : (
                <TikTokActions
                  connected={tiktokConnected}
                  status={tiktokStatus}
                  connectingSince={tiktokConnectingSince}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Segurança */}
      <div className="flex items-start gap-3 rounded-md border border-border-soft bg-surface/40 px-4 py-3.5">
        <ShieldCheck size={18} className="text-success flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          Suas conexões são protegidas. O Inst Acessor armazena seu acesso de forma
          criptografada e nunca publica nada na sua conta sem sua autorização.
        </p>
      </div>

      {/* Nota de privacidade */}
      <div className="flex items-start gap-3">
        <Info size={16} className="text-ink-muted flex-none mt-0.5" />
        <p className="text-[12.5px] text-ink-muted">
          Para conectar, você será direcionado ao fluxo seguro de autorização da
          plataforma. O Inst Acessor solicita apenas as permissões necessárias
          para ler métricas do seu perfil.
        </p>
      </div>
    </div>
  );
}
