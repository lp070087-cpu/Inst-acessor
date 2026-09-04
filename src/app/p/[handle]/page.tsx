import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { levelInfoFromXp } from "@/lib/gamification/xp";
import {
  PublicProfileView,
  type PublicProfilePayload,
  type PublicAchievementItem,
} from "@/components/gamification/public-profile-view";

export const dynamic = "force-dynamic";

interface PublicProfileRouteProps {
  params: { handle: string };
}

/**
 * ROTA PÚBLICA /p/[handle]
 * =========================
 * Perfil público de EVOLUÇÃO e GAMIFICAÇÃO — SEM dados privados.
 *
 * Segurança:
 * - A rota NÃO está no matcher do middleware → acessível sem sessão.
 * - Busca SOMENTE campos públicos e computa posição/XP/social de tabelas reais.
 * - NUNCA expõe: email, tokens, billing/admin, conexões, IDs internos,
 *   configurações privadas, preferências, perfil de IA, metas, conteúdo.
 * - handle resolve por (1) @ do perfil IG conectado, (2) nome de usuário do
 *   perfil do Inst Acessor — o mesmo "username" usado no botão de copiar link.
 */
export default async function PublicProfilePage({ params }: PublicProfileRouteProps) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "").trim();
  if (!handle) notFound();

  // 1) Resolve o userId dono do handle (somente leitura, campos públicos).
  const igByHandle = await prisma.instagramProfile.findFirst({
    where: { username: { equals: handle, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });
  const profileByHandle = igByHandle
    ? null
    : await prisma.userProfile.findFirst({
        where: { username: { equals: handle, mode: "insensitive" } },
        select: { userId: true, username: true, displayName: true, avatar: true },
      });

  const userId = igByHandle?.userId ?? profileByHandle?.userId;
  if (!userId) notFound();

  // 2) Dados públicos: conta (nome/foto) + IG mais recente do usuário.
  const [user, igLatest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, image: true },
    }),
    prisma.instagramProfile.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        username: true,
        name: true,
        profilePictureUrl: true,
        followersCount: true,
      },
    }),
  ]);

  const avatar = igLatest?.profilePictureUrl ?? profileByHandle?.avatar ?? user?.image ?? null;
  const igUsername = igLatest?.username ?? null;
  const displayName =
    igLatest?.name ??
    profileByHandle?.displayName ??
    user?.name ??
    (igUsername ? `@${igUsername}` : "Usuário");

  // 3) Progressão real (XP/nível) + posição real no ranking.
  const levelRow = await prisma.userLevel.findUnique({ where: { userId } });
  const totalXp = levelRow?.xp ?? 0;
  const info = levelInfoFromXp(totalXp);
  const better = await prisma.userLevel.count({ where: { xp: { gt: totalXp } } });
  const totalUsers = await prisma.userLevel.count();
  const position = levelRow ? better + 1 : null;

  // 4) Social real (seguidores + crescimento em 30 dias).
  const followers = igLatest?.followersCount ?? null;
  const snapshots = await prisma.instagramSnapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, followersCount: true },
  });
  let growth30d: number | null = null;
  const currentFollowers = snapshots[snapshots.length - 1]?.followersCount ?? followers;
  if (snapshots.length > 0 && currentFollowers != null) {
    const cutoff = Date.now() - 30 * 864e5;
    let past: { followersCount: number | null } | null = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].capturedAt.getTime() <= cutoff) {
        past = snapshots[i];
        break;
      }
    }
    if (past?.followersCount != null) growth30d = currentFollowers - past.followersCount;
  }

  // 5) Conquistas desbloqueadas (reais) — join com o catálogo Achievement.
  const unlockedRows = await prisma.userAchievement.findMany({
    where: { userId, unlocked: true },
    orderBy: { unlockedAt: "desc" },
    select: {
      unlockedAt: true,
      achievement: {
        select: {
          slug: true,
          title: true,
          description: true,
          category: true,
          tier: true,
          xpReward: true,
        },
      },
    },
  });
  const achievements: PublicAchievementItem[] = unlockedRows.map((r) => ({
    slug: r.achievement.slug,
    title: r.achievement.title,
    description: r.achievement.description,
    category: r.achievement.category,
    tier: r.achievement.tier,
    xpReward: r.achievement.xpReward,
    unlockedAt: r.unlockedAt ? r.unlockedAt.toISOString() : null,
  }));

  const payload: PublicProfilePayload = {
    handle: igUsername ?? profileByHandle?.username ?? handle,
    name: displayName,
    image: avatar,
    instagramUsername: igUsername,
    level: info.level,
    xp: totalXp,
    totalXpEarned: levelRow?.totalXpEarned ?? totalXp,
    xpInLevel: info.xpInLevel,
    xpNeededForNext: info.xpNeededForNext,
    progressToNext: levelRow
      ? Math.min(100, Math.round((info.xpInLevel / info.xpNeededForNext) * 100))
      : 0,
    position,
    totalUsers,
    followers,
    growth30d,
    achievements,
  };

  return (
    <main className="min-h-screen py-6 px-4 sm:py-10">
      <div className="w-full max-w-3xl mx-auto mb-6">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink transition-colors"
        >
          <span className="font-display text-[15px] font-extrabold bg-gradient-to-r from-[#F43F8E] via-[#A855F7] to-[#6366F1] bg-clip-text text-transparent">
            Inst Acessor
          </span>
          <span aria-hidden>→</span>
          <span>Perfil público</span>
        </a>
      </div>
      <PublicProfileView payload={payload} />
    </main>
  );
}
