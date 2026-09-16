import type { Metadata } from "next";

import { requireOnboardedSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getAccountData } from "@/lib/profile/account";
import { describeSync } from "@/lib/dashboard/freshness";
import { PerfilClient } from "@/components/account/perfil-client";
import type { PerfilConnection } from "@/components/account/perfil-client";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Seus dados e preferências de conta.",
};

export const dynamic = "force-dynamic";

/**
 * PERFIL — dados da conta do Inst Acessor.
 *
 * Esta tela edita a CONTA. O conhecimento estratégico (tom de voz, padrões
 * observados, formatos preferidos) continua em `/perfil-de-inteligencia`, que
 * lê a MESMA fonte quando o assunto é nicho/subnicho/objetivo — aqui não existe
 * uma segunda versão desses campos.
 *
 * Antes desta versão a tela lia `session.user.name`/`session.user.image`. A
 * sessão é JWT: esses valores são congelados no login, então uma edição só
 * apareceria depois de sair e entrar de novo. Por isso os dados vêm do BANCO.
 */
export default async function PerfilPage() {
  const { session } = await requireOnboardedSession();
  const userId = session.user.id;

  const [account, userRow, igConnection, ttConnection, igProfile, ttProfile] =
    await Promise.all([
      getAccountData(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
      prisma.socialConnection.findFirst({
        where: { userId, platform: "instagram" },
        select: { status: true, username: true, lastSyncAt: true },
      }),
      prisma.socialConnection.findFirst({
        where: { userId, platform: "tiktok" },
        select: { status: true, username: true, lastSyncAt: true },
      }),
      // Avatares das contas CONECTADAS — nunca copiados para a conta do app.
      prisma.instagramProfile.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { profilePictureUrl: true },
      }),
      prisma.tikTokProfile.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { avatarUrl: true },
      }),
    ]);

  if (!account) {
    // Sessão válida sem linha de usuário: estado de erro real, não inventamos
    // uma conta vazia no lugar.
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[26px] font-bold text-ink">Perfil</h1>
        <p className="text-[13.5px] text-ink-soft">
          Não foi possível carregar os dados da sua conta agora. Atualize a página
          para tentar novamente.
        </p>
      </div>
    );
  }

  const connections: PerfilConnection[] = [
    {
      platform: "instagram",
      connected: igConnection?.status === "CONNECTED",
      username: igConnection?.username ?? null,
      avatarUrl: igProfile?.profilePictureUrl ?? null,
      syncLabel: igConnection?.lastSyncAt ? describeSync(igConnection.lastSyncAt).label : null,
      syncStale: describeSync(igConnection?.lastSyncAt ?? null).stale,
    },
    {
      platform: "tiktok",
      connected: ttConnection?.status === "CONNECTED",
      username: ttConnection?.username ?? null,
      avatarUrl: ttProfile?.avatarUrl ?? null,
      syncLabel: ttConnection?.lastSyncAt ? describeSync(ttConnection.lastSyncAt).label : null,
      syncStale: describeSync(ttConnection?.lastSyncAt ?? null).stale,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold text-ink">Perfil</h1>
        <p className="text-[13.5px] text-ink-soft">
          Sua foto, seus dados e a segurança da sua conta.
        </p>
      </div>

      <PerfilClient
        account={{
          name: account.name,
          email: account.email,
          avatar: account.avatar,
          displayName: account.displayName,
          username: account.username,
          niche: account.niche,
          subNiche: account.subNiche,
          objective: account.objective,
          createdAt: account.createdAt.toISOString(),
        }}
        connections={connections}
        hasPassword={Boolean(userRow?.passwordHash)}
        // WEBP fica desligado enquanto o reencode do canvas não for garantido em
        // todos os navegadores suportados.
        acceptsWebp={false}
      />
    </div>
  );
}
