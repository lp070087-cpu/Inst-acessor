/**
 * PLATAFORMAS ACOMPANHADAS — NÚCLEO PURO
 * ======================================
 * O usuário diz QUAIS redes ele acompanha no Inst Acessor:
 *   "instagram" · "tiktok" · "both" (padrão)
 *
 * Por que existe: até aqui o app assumia "as duas" em silêncio. Quem só usa
 * TikTok via as conquistas de Instagram travadas em 0/5 para sempre — um zero
 * que não é desempenho, é ABSÊNCIA (a regra do projeto é que ausência nunca
 * vire zero). A escolha é o que permite esconder o que não se aplica em vez de
 * mostrar uma barra de progresso vazia.
 *
 * Este arquivo contém SOMENTE a lógica pura (sem banco), para ser testável de
 * forma determinística. A leitura/gravação vive em `platforms.ts`.
 *
 * Nenhum dado é inventado: a preferência é só um filtro de EXIBIÇÃO. Ela não
 * altera o XP, não apaga conquista desbloqueada e não esconde o que o usuário
 * já conquistou.
 */

export type TrackedPlatform = "instagram" | "tiktok";
export type PlatformSelection = TrackedPlatform | "both";

export const PLATFORM_SELECTIONS: readonly PlatformSelection[] = [
  "instagram",
  "tiktok",
  "both",
] as const;

export const DEFAULT_PLATFORM_SELECTION: PlatformSelection = "both";

/** Rótulos oficiais — a UI e o servidor falam a MESMA língua. */
export const PLATFORM_SELECTION_LABELS: Record<PlatformSelection, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  both: "Instagram e TikTok",
};

/** Normaliza um valor arbitrário vindo do JSON/HTTP. Desconhecido → padrão. */
export function normalizePlatformSelection(value: unknown): PlatformSelection {
  return typeof value === "string" &&
    (PLATFORM_SELECTIONS as readonly string[]).includes(value)
    ? (value as PlatformSelection)
    : DEFAULT_PLATFORM_SELECTION;
}

/** Preferência armazenada no JSON `dashboard` (merge seguro, sem schema novo). */
export function readStoredPlatforms(dashboard: unknown): PlatformSelection {
  if (dashboard && typeof dashboard === "object") {
    const d = dashboard as Record<string, unknown>;
    return normalizePlatformSelection(d.trackedPlatforms);
  }
  return DEFAULT_PLATFORM_SELECTION;
}

/** A seleção inclui esta plataforma? */
export function selectionIncludes(
  selection: PlatformSelection,
  platform: TrackedPlatform
): boolean {
  return selection === "both" || selection === platform;
}

/** Lista concreta das plataformas acompanhadas (útil para consultas). */
export function platformsOf(selection: PlatformSelection): TrackedPlatform[] {
  if (selection === "both") return ["instagram", "tiktok"];
  return [selection];
}

/**
 * A CONQUISTA se aplica à seleção do usuário?
 *
 * Regra: conquista SEM plataforma (genérica) sempre se aplica. Conquista DE
 * plataforma só aparece se aquela plataforma está na seleção — OU se já foi
 * DESBLOQUEADA, caso em que permanece visível para sempre. Trocar a preferência
 * não pode apagar um troféu que o usuário já ganhou.
 */
export function achievementApplies(
  selection: PlatformSelection,
  platform: TrackedPlatform | null | undefined,
  unlocked = false
): boolean {
  if (!platform) return true;
  if (unlocked) return true;
  return selectionIncludes(selection, platform);
}
