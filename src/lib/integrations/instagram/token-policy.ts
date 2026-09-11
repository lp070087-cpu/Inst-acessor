/**
 * POLÍTICA DE RENOVAÇÃO DO TOKEN — INSTAGRAM BUSINESS LOGIN
 * =========================================================
 * Módulo PURO (sem rede, sem banco, sem Next) que decide quando vale chamar
 * a renovação do token de longa duração.
 *
 * Regras oficiais da API do Instagram:
 *   - o token de longa duração dura ~60 dias;
 *   - a renovação (`grant_type=ig_refresh_token`) só é aceita para token com
 *     MAIS DE 24 HORAS de vida;
 *   - token expirado não pode ser renovado — é preciso reconectar.
 *
 * Por isso não renovamos a cada clique: chamar cedo demais só produziria erro
 * garantido. Renovamos quando o token está perto de expirar (margem de 5 dias).
 */

/** Renova quando faltar menos que isto para expirar (5 dias). */
export const RENEWAL_MARGIN_MS = 5 * 24 * 60 * 60 * 1000;

/** A API exige token com mais de 24h de vida para renovar. */
export const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Decide se vale tentar renovar o token agora.
 *
 * @param expiresAt  validade do token persistido (pode ser desconhecida)
 * @param createdAt  quando a conexão foi criada (idade mínima do token)
 * @param now        relógio injetável (determinismo nos testes)
 */
export function shouldAttemptRenewal(
  expiresAt: Date | null | undefined,
  createdAt: Date | null | undefined,
  now = Date.now()
): boolean {
  const age = createdAt ? now - createdAt.getTime() : Number.POSITIVE_INFINITY;
  // Menos de 24h → a própria API recusaria. Não chama.
  if (age < MIN_TOKEN_AGE_MS) return false;
  // Sem validade conhecida: tentar é a única forma de descobrir; a falha é
  // tratada sem derrubar o token atual.
  if (!expiresAt) return true;
  // Perto de expirar (ou já expirado) → renova.
  return expiresAt.getTime() - now < RENEWAL_MARGIN_MS;
}
