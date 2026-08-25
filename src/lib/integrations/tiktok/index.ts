/**
 * Camada de serviço do TikTok — ponto de entrada único.
 * Consumido por API routes e pelo Dashboard.
 */
export * from "./types";
export * from "./errors";
export {
  buildAuthUrl,
  exchangeCodeForToken,
  encryptAccessToken,
  createPkce,
  refreshTikTokToken,
} from "./oauth";
export {
  tiktokApiGet,
  tiktokApiPost,
  getTikTokCredentials,
  getTikTokRedirectUri,
  TikTokApiError,
} from "./client";
export { collectTikTokData, getTikTokUser, getTikTokVideos } from "./metrics";
export { syncTikTok, TIKTOK_COOLDOWN_MS } from "./sync";
