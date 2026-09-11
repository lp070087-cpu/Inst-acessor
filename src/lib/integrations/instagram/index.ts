/**
 * Camada de serviço do Instagram — ponto de entrada único.
 * Consumido por API routes e pelo Dashboard.
 *
 * Fluxo: INSTAGRAM BUSINESS LOGIN (app Meta "Inst Acessor").
 *   - Autorização  → https://www.instagram.com/oauth/authorize
 *   - Token        → https://api.instagram.com/oauth/access_token  (code → curto)
 *                    https://graph.instagram.com/access_token      (curto → longo)
 *   - Dados/insights/publicação → https://graph.instagram.com
 *
 * NÃO usa Facebook Login nem `graph.facebook.com` e NÃO exige Página do
 * Facebook vinculada à conta profissional do Instagram.
 *
 * Nota sobre exports:
 * - `types`, `errors`, `client` e `metrics` são re-exportados sem duplicação.
 * - `InstagramApiError` vem de "./errors" (que re-exporta de "./client"),
 *   evitando nome duplicado entre `export *` e `export { }` explícito.
 */
export * from "./types";
export * from "./errors";
export {
  graphGet,
  graphGetNoRetry,
  postFormNoRetry,
  getMetaCredentials,
  getWebhookAppSecret,
  getRedirectUri,
  INSTAGRAM_GRAPH_BASE,
  INSTAGRAM_OAUTH_BASE,
  INSTAGRAM_AUTHORIZE_BASE,
} from "./client";
export {
  buildAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  encryptAccessToken,
  getInstagramScopes,
  INSTAGRAM_DEFAULT_SCOPES,
} from "./oauth";
export {
  collectInstagramData,
  getInstagramAccountInfo,
  getInstagramUser,
  getAccountInsights,
  getRecentMedia,
  getMediaMetrics,
  normalizeAccountType,
} from "./metrics";
export { syncInstagram, INSTAGRAM_COOLDOWN_MS } from "./sync";
