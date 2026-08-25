/**
 * Camada de serviço do Instagram — ponto de entrada único.
 * Consumido por API routes e pelo Dashboard.
 *
 * Nota sobre exports:
 * - `types`, `errors`, `client` e `metrics` são re-exportados sem duplicação.
 * - `InstagramApiError` vem de "./errors" (que re-exporta de "./client"),
 *   evitando nome duplicado entre `export *` e `export { }` explícito.
 */
export * from "./types";
export * from "./errors";
export { graphGet, getMetaCredentials, getRedirectUri } from "./client";
export { buildAuthUrl, exchangeCodeForToken, encryptAccessToken } from "./oauth";
export {
  collectInstagramData,
  getInstagramAccountInfo,
  getInstagramUser,
  getAccountInsights,
  getRecentMedia,
  getMediaMetrics,
} from "./metrics";
export { syncInstagram, INSTAGRAM_COOLDOWN_MS } from "./sync";
