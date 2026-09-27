import { prisma } from "@/lib/db";

import {
  DEFAULT_PLATFORM_SELECTION,
  normalizePlatformSelection,
  readStoredPlatforms,
  type PlatformSelection,
} from "./platforms-core";

/**
 * PLATAFORMAS ACOMPANHADAS — acesso ao banco
 * ===========================================
 * Mesmo padrão de `display-name.ts` (rodada #274): a preferência vive no JSON
 * `UserPreferences.dashboard`, sob a chave `trackedPlatforms`
 * ("instagram" | "tiktok" | "both"). SEM mudança de schema.
 *
 * Importante: a preferência é um filtro de EXIBIÇÃO. Não concede nem retira
 * acesso, não altera XP e não apaga conquista já desbloqueada.
 */

export * from "./platforms-core";

/**
 * Nome da coluna/relação de cada plataforma nas tabelas de conexão.
 * Fica aqui (e não na UI) para o dia em que uma terceira rede entrar: muda em
 * um lugar só.
 */
export const PLATFORM_CONNECTION_META: Record<
  "instagram" | "tiktok",
  { label: string; connectionPlatform: string }
> = {
  instagram: { label: "Instagram", connectionPlatform: "instagram" },
  tiktok: { label: "TikTok", connectionPlatform: "tiktok" },
};

/** Lê a preferência gravada (com o padrão honesto quando não há nada). */
export async function getPlatformSelection(userId: string): Promise<PlatformSelection> {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { dashboard: true },
  });
  return readStoredPlatforms(prefs?.dashboard);
}

/** Grava a preferência (merge no JSON `dashboard`, preservando outras chaves). */
export async function setPlatformSelection(
  userId: string,
  selection: PlatformSelection
): Promise<PlatformSelection> {
  const value = normalizePlatformSelection(selection);

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { dashboard: true },
  });

  const base =
    prefs?.dashboard && typeof prefs.dashboard === "object"
      ? (prefs.dashboard as Record<string, unknown>)
      : {};
  // Mesmo padrão do `display-name.ts` e da Fase 4: o objeto passa por
  // JSON.parse(JSON.stringify(...)) para virar um valor compatível com o Json
  // do Prisma sem perder as chaves que não são nossas.
  const dashboard = JSON.parse(JSON.stringify({ ...base, trackedPlatforms: value }));

  await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, dashboard },
    update: { dashboard },
  });

  return value;
}

export { DEFAULT_PLATFORM_SELECTION };
