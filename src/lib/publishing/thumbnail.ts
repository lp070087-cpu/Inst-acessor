/**
 * Official Meta Reels sample documents thumb_offset in milliseconds:
 * github.com/fbsamples/reels_publishing_apis/tree/main/insta_reels_publishing_api_sample
 * Instagram Login acceptance remains subject to authorized external validation.
 * No cover_url upload or external operation happens in this pure helper.
 */
export function applyInstagramThumbnail(body: Record<string, string>, mediaType: string, coverTimeMs?: number): void {
  if (mediaType !== "REELS" || coverTimeMs === undefined) return;
  if (!Number.isSafeInteger(coverTimeMs) || coverTimeMs < 0 || coverTimeMs > 180_000) {
    throw new Error("Instante da capa do Reel inválido.");
  }
  body.thumb_offset = String(coverTimeMs);
}
