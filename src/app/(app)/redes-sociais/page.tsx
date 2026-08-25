import type { Metadata } from "next";
import { Instagram, Music2, ShieldCheck, Info } from "lucide-react";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { Avatar } from "@/components/ui/avatar";
import { InstagramActions } from "@/components/integrations/instagram-actions";
import { TikTokActions } from "@/components/integrations/tiktok-actions";

export const metadata: Metadata = {
  title: "Redes Sociais",
  description: "Conecte e gerencie suas redes sociais.",
};

type PlatformConnection = {
  platform: "instagram" | "tiktok";
  status: string | null;
  username: string | null;
  accountType: string | null;
  lastSyncAt: Date | null;
  avatarName: string;
};

function formatLastSync(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function RedesSociaisPage() {
  const { session } = await requireOnboardedSession();

  const [instagram, tiktok] = await Promise.all([
    prisma.socialConnection.findFirst({
      where: { userId: session.user.id, platform: "instagram" },
    }),
    prisma.socialConnection.findFirst({
      where: { userId: session.user.id, platform: "tiktok" },
    }),
  ]);

  const instagramConnected = instagram?.status === "CONNECTED";
  const tiktokConnected = tiktok?.status === "CONNECTED";

  const cards: PlatformConnection[] = [
    {
      platform: "instagram",
      status: instagram?.status ?? "DISCONNECTED",
      username: instagram?.username ?? null,
      accountType: instagram?.accountType ?? null,
      lastSyncAt: instagram?.lastSyncAt ?? null,
      avatarName: instagram?.username ?? "IG",
    },
    {
      platform: "tiktok",
      status: tiktok?.status ?? "DISCONNECTED",
      username: tiktok?.username ?? null,
      accountType: tiktok?.accountType ?? null,
      lastSyncAt: tiktok?.lastSyncAt ?? null,
      avatarName: tiktok?.username ?? "TK",
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

          return (
            <div
              key={card.platform}
              className="bg-card border border-border-soft rounded-lg shadow-xs p-6"
            >
              <div className="flex items-start gap-4 flex-wrap">
                <span className="w-12 h-12 rounded-[14px] bg-ai-soft text-purple grid place-items-center flex-none">
                  <Icon size={22} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-display text-[17px] font-bold text-ink">
                      {card.platform === "instagram" ? "Instagram" : "TikTok"}
                    </h2>
                    {connected ? (
                      <StatusBadge status={card.status ?? "DISCONNECTED"} />
                    ) : (
                      <span className="inline-flex items-center rounded-pill bg-surface text-ink-soft border border-border-soft font-semibold text-[11px] uppercase tracking-wider px-2.5 py-1 whitespace-nowrap">
                        Conta não conectada
                      </span>
                    )}
                  </div>

                  <p className="text-[13px] text-ink-soft mt-1">
                    {connected
                      ? `Conectado como @${card.username ?? ""}`
                      : card.platform === "instagram"
                        ? "Conecte seu perfil profissional para acompanhar seguidores, engajamento, alcance e muito mais."
                        : "Conecte seu perfil para acompanhar seguidores, curtidas, vídeos e muito mais."}
                  </p>
                </div>

                {connected && (
                  <div className="flex items-center gap-3 flex-none">
                    <Avatar name={card.avatarName} src={null} size="lg" />
                  </div>
                )}
              </div>

              {connected && (
                <>
                  <Divider className="my-5" />

                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-[13.5px]">
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                        Usuário
                      </dt>
                      <dd className="mt-1 text-ink font-medium">
                        @{card.username ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                        Tipo de conta
                      </dt>
                      <dd className="mt-1 text-ink font-medium">
                        {card.platform === "instagram"
                          ? card.accountType === "BUSINESS"
                            ? "Profissional (Business)"
                            : card.accountType === "CREATOR"
                              ? "Profissional (Creator)"
                              : card.accountType ?? "—"
                          : card.accountType === "BUSINESS"
                            ? "Conta Business"
                            : card.accountType ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                        Última sincronização
                      </dt>
                      <dd className="mt-1 text-ink font-medium">
                        {formatLastSync(card.lastSyncAt)}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              <Divider className="my-5" />

              {card.platform === "instagram" ? (
                <InstagramActions
                  connected={instagramConnected}
                  status={(card.status ?? "DISCONNECTED") as "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR"}
                />
              ) : (
                <TikTokActions
                  connected={tiktokConnected}
                  status={(card.status ?? "DISCONNECTED") as "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR"}
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
