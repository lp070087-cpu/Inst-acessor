import { prisma } from "@/lib/db";
import { gp } from "./db";
import { levelInfoFromXp } from "./xp";
import { getRankSocialSummary, getUserRankSummary } from "./ranking";
import type {
  PublicAchievementItem,
  PublicProfilePayload,
} from "@/components/gamification/public-profile-view";

/**
 * PERFIL PÚBLICO — rota `/p/[slug]`
 * =================================
 * Resolve o identificador público de um usuário e monta um payload
 * ESTRITAMENTE público, para consumo da rota pública `/p/[slug]`.
 *
 * Regras de privacidade (não negociáveis):
 *   • NUNCA expõe e-mail, tokens, ids internos, dados de faturamento,
 *     preferências, metas privadas ou o histórico de XP.
 *   • Só devolve conquistas DESBLOQUEADAS e NÃO ocultas (`hidden === false`).
 *   • Métricas sociais vêm de `getRankSocialSummary` (dados reais de
 *     Instagram já conectado). Sem conta/snapshot → `null` (a UI mostra "—"),
 *     nunca um número inventado.
 *
 * Importante: esta é uma leitura pura.
 *   • NÃO chama `getUserProgress` / `getUserAchievements` / `ensureLevel`,
 *     porque esses helpers CRIAM linhas no banco (`ensureLevel`,
 *     `ensureUserAchievements`). Uma rota pública não deve escrever.
 *   • Lê `UserLevel` e `UserAchievement` diretamente, sem efeitos colaterais.
 *
 * O slug aceito é: primeiro o `UserProfile.username`; se não houver, cai para
 * o `@username` da conta Instagram conectada — exatamente a mesma ordem que o
 * Rank usa para montar o link (`rank-client.tsx` → `publicProfileUrl`).
 */

/** Normaliza o slug: decodifica, remove "@", espaços e barras. */
export function normalizePublicSlug(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // slug mal formado (URI inválida) — segue com o valor cru
  }
  value = value.trim().replace(/^@+/, "").replace(/[/\\?#]/g, "");
  return value.length > 0 ? value : null;
}

interface AchievementRow {
  achievementId: string;
  unlockedAt: Date | null;
}

interface AchievementDef {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  xpReward: number;
  hidden: boolean;
}

interface LevelRow {
  xp: number;
  level: number;
  totalXpEarned: number;
}

/**
 * Carrega o perfil público de um slug.
 * Retorna `null` quando não existe usuário para o slug (a rota mostra o 404
 * elegante) — nunca quando o usuário existe mas ainda não tem XP.
 */
export async function loadPublicProfile(
  rawSlug: string
): Promise<PublicProfilePayload | null> {
  const slug = normalizePublicSlug(rawSlug);
  if (!slug) return null;

  // 1) Fonte preferida do link: o @username do perfil do Inst Acessor.
  const profile = await prisma.userProfile.findFirst({
    where: { username: { equals: slug, mode: "insensitive" } },
    select: { userId: true, username: true, displayName: true, avatar: true },
  });

  // 2) Fallback: o @username da conta Instagram conectada (é o segundo
  //    candidato usado pelo Rank ao montar o link público).
  const ig = profile
    ? null
    : await prisma.instagramProfile.findFirst({
        where: { username: { equals: slug, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        select: {
          userId: true,
          username: true,
          name: true,
          profilePictureUrl: true,
        },
      });

  const userId = profile?.userId ?? ig?.userId ?? null;
  if (!userId) return null;

  // 3) Leituras públicas em paralelo — todas sem efeito colateral.
  const [user, levelRow, summary, social, unlockedRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, image: true },
    }),
    gp.level.findUnique({
      where: { userId },
      select: { xp: true, level: true, totalXpEarned: true },
    }),
    getUserRankSummary(userId),
    getRankSocialSummary(userId),
    gp.userAchievement.findMany({
      where: { userId, unlocked: true },
      orderBy: { unlockedAt: "desc" },
    }),
  ]);

  // 4) Conquistas: busca as definições em UMA consulta (sem N+1) e descarta
  //    as ocultas — elas não são públicas por definição.
  const rows = (unlockedRows as AchievementRow[]).filter((r) => r.unlockedAt !== null);
  const ids = rows.map((r) => r.achievementId);
  const defs =
    ids.length > 0
      ? await gp.achievement.findMany({ where: { id: { in: ids } } })
      : [];
  const byId = new Map<string, AchievementDef>(
    (defs as AchievementDef[]).map((d) => [d.id, d])
  );

  const achievements: PublicAchievementItem[] = rows
    .map((r) => {
      const d = byId.get(r.achievementId);
      if (!d || d.hidden) return null;
      return {
        slug: d.slug,
        title: d.title,
        description: d.description,
        category: d.category,
        tier: d.tier,
        xpReward: d.xpReward,
        unlockedAt: r.unlockedAt ? r.unlockedAt.toISOString() : null,
      } satisfies PublicAchievementItem;
    })
    .filter((a): a is PublicAchievementItem => a !== null);

  // 5) Progressão. O XP pode não ter linha ainda (usuário sem nenhuma ação):
  //    nesse caso o perfil é válido, só está no nível 1 com 0 XP.
  const xp = levelRow ? (levelRow as LevelRow).xp : 0;
  const totalXpEarned = levelRow ? (levelRow as LevelRow).totalXpEarned : 0;
  const info = levelInfoFromXp(xp);

  // `position` é a posição no ranking global (não é dado sensível) — vem de
  // `getUserRankSummary`, que devolve `null` quando o usuário não tem XP.
  const instagramUsername = social.instagramUsername ?? ig?.username ?? null;

  return {
    handle: profile?.username ?? instagramUsername ?? slug,
    name:
      profile?.displayName ??
      ig?.name ??
      instagramUsername ??
      user?.name ??
      "Usuário",
    image: profile?.avatar ?? ig?.profilePictureUrl ?? user?.image ?? null,
    instagramUsername,
    level: info.level,
    xp,
    totalXpEarned,
    xpInLevel: info.xpInLevel,
    xpNeededForNext: info.xpNeededForNext,
    progressToNext: Math.min(
      100,
      Math.round((info.xpInLevel / info.xpNeededForNext) * 10000) / 100
    ),
    position: summary.position,
    totalUsers: summary.totalUsers,
    followers: social.followers,
    growth30d: social.growth30d,
    achievements,
  };
}
