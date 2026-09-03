import { prisma } from "@/lib/db";

/**
 * NOME EXIBIDO — rodada #274
 * ===========================
 * O usuário escolhe como aparece no Rank/ranking/perfil:
 *   1) "Nome do perfil do Inst Acessor" (padrão — fallback "Usuário")
 *   2) "Nome/@username da conta Instagram conectada"
 *
 * Este arquivo concentra o acesso ao banco. A lógica pura de resolução vive em
 * `display-name-core.ts` (re-exportada daqui) — o barrel `gamification/index.ts`
 * continua expondo o MESMO contrato.
 *
 * SEM mudança de schema: a preferência vive no JSON `UserPreferences.dashboard`
 * sob a chave `displayNameSource` ("profile" | "instagram"). A resolução sempre
 * tem fallback honesto — se escolheu Instagram mas não há conta conectada
 * (ou sem nome/@username), cai para o nome do perfil.
 */

export * from "./display-name-core";
import { readStoredSource, resolveDisplayName } from "./display-name-core";
import type { InstagramProfileLike, DisplayNameSource } from "./display-name-core";

export interface DisplayNameInfo {
  /** Preferência EFETIVAMENTE aplicada (após fallbacks reais). */
  source: DisplayNameSource;
  /** Nome final que deve ser exibido. */
  value: string;
  /** Preferência armazenada pelo usuário (antes de fallback). */
  storedSource: DisplayNameSource;
  profileName: string | null;
  profileUsername: string | null;
  /** Nome real da conta Instagram conectada (se houver). */
  igName: string | null;
  /** @username real da conta Instagram conectada (se houver). */
  igUsername: string | null;
  hasInstagram: boolean;
}

/** Lê o estado de nome exibido do usuário com fallback honesto. */
export async function getDisplayNameInfo(userId: string): Promise<DisplayNameInfo> {
  const [profile, prefs, ig] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true, username: true },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: { dashboard: true },
    }),
    prisma.instagramProfile.findFirst({
      where: { userId, OR: [{ name: { not: null } }, { username: { not: null } }] },
      orderBy: { createdAt: "desc" },
      select: { name: true, username: true },
    }),
  ]);

  const stored = readStoredSource(prefs?.dashboard);
  const resolved = resolveDisplayName(stored, profile?.displayName ?? null, ig as InstagramProfileLike | null);
  const igValue = ig?.name || (ig?.username ? `@${ig.username}` : null) || null;

  return {
    source: resolved.source,
    value: resolved.value,
    storedSource: stored,
    profileName: profile?.displayName ?? null,
    profileUsername: profile?.username ?? null,
    igName: ig?.name ?? null,
    igUsername: ig?.username ?? null,
    hasInstagram: Boolean(igValue),
  };
}

/** Define a preferência de nome exibido (merge no JSON dashboard). */
export async function setDisplayNameSource(
  userId: string,
  source: DisplayNameSource
): Promise<void> {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { dashboard: true },
  });

  const base =
    prefs?.dashboard && typeof prefs.dashboard === "object"
      ? (prefs.dashboard as Record<string, unknown>)
      : {};
  // JSON.parse(JSON.stringify(...)): mesmo padrão da Fase 4 (score.ts) para
  // valores compatíveis com o tipo Json do Prisma.
  const dashboard = JSON.parse(JSON.stringify({ ...base, displayNameSource: source }));

  await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, dashboard },
    update: { dashboard },
  });
}

/** Aplica o nome resolvido à entrada "me" de um ranking (self-only). */
export function applySelfDisplayName<T extends { isMe: boolean; name: string | null }>(
  entries: T[],
  info: DisplayNameInfo
): T[] {
  return entries.map((e) => (e.isMe ? { ...e, name: info.value } : e));
}
