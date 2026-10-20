import assert from "node:assert/strict";
import { applyInstagramThumbnail } from "../src/lib/publishing/thumbnail.ts";
globalThis.fetch = async () => { throw new Error("External network prohibited"); };
let checks = 0;
const check = (value) => { assert.ok(value); checks++; };
for (const offset of [0, 1, 1500, 179999, 180000]) {
  const body = { media_type: "REELS", video_url: "https://fixture.invalid/video.mp4", caption: "Synthetic caption" };
  applyInstagramThumbnail(body, "REELS", offset);
  check(body.thumb_offset === String(offset));
  check(body.video_url === "https://fixture.invalid/video.mp4" && !Object.hasOwn(body, "cover_url"));
}
for (const invalid of [-1, NaN, Infinity, -Infinity, 180001, 1.5, "1500", null]) {
  assert.throws(() => applyInstagramThumbnail({}, "REELS", invalid)); checks++;
}
for (const kind of ["IMAGE", "STORIES", "CAROUSEL"]) {
  const body = { media_type: kind };
  applyInstagramThumbnail(body, kind, 1500);
  check(!Object.hasOwn(body, "thumb_offset"));
}
const untouched = { media_type: "REELS" };
applyInstagramThumbnail(untouched, "REELS");
check(!Object.hasOwn(untouched, "thumb_offset"));
console.log(`${checks} Reel cover payload checks passed (pure; provider integration pending).`);
