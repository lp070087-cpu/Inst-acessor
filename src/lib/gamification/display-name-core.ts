/**
 * NOME EXIBIDO — NÚCLEO PURO (rodada #274)
 * =========================================
 * Resolução da preferência de nome exibido no Rank/ranking/perfil:
 *   1) "Nome do perfil do Inst Acessor" (padrão — fallback "Usuário")
 *   2) "Nome/@username da conta Instagram conectada"
 *
 * Este arquivo contém SOMENTE a lógica pura (sem banco) para permitir testes
 * determinísticos. A leitura/gravação no banco vive em `display-name.ts`, que
 * re-exporta este módulo.
 *
 * Regra: a resolução SEMPRE tem fallback honesto — se escolheu Instagram mas
 * não há conta conectada (ou sem nome/@username), cai para o nome do perfil.
 */

export type DisplayNameSource = "profile" | "instagram";

export interface InstagramProfileLike {
  name: string | null;
  username: string | null;
}

export interface ResolvedDisplayName {
  /** Preferência EFETIVAMENTE aplicada (após fallbacks reais). */
  source: DisplayNameSource;
  /** Nome final que deve ser exibido. */
  value: string;
}

/** Preferência armazenada no JSON `dashboard` (merge seguro). */
export function readStoredSource(dashboard: unknown): DisplayNameSource {
  if (dashboard && typeof dashboard === "object") {
    const d = dashboard as Record<string, unknown>;
    return d.displayNameSource === "instagram" ? "instagram" : "profile";
  }
  return "profile";
}

/** Resolve o nome a partir das fontes reais (nunca inventa). */
export function resolveDisplayName(
  source: DisplayNameSource,
  profileName: string | null,
  ig: InstagramProfileLike | null
): ResolvedDisplayName {
  const igValue =
    ig?.name ||
    (ig?.username ? `@${ig.username}` : null) ||
    null;
  const hasInstagram = Boolean(igValue);

  if (source === "instagram" && hasInstagram) {
    return { source: "instagram", value: igValue as string };
  }
  return { source: "profile", value: profileName || "Usuário" };
}
