import assert from "node:assert/strict";
import { checkCompatibility, expectedMediaType } from "../src/lib/publishing/compatibility.ts";

globalThis.fetch = async () => { throw new Error("Network is forbidden in this pure test"); };
let checks = 0;
const check = (condition) => { assert.ok(condition); checks++; };
const issues = (format, mimeType, platform = "instagram") => checkCompatibility({
  platform, format, mimeType, mediaCount: 1, hasCaption: true,
});
check(expectedMediaType("instagram", "story") === "any");
for (const mime of ["image/jpeg", "image/png", "video/mp4"]) {
  check(!issues("story", mime).some((issue) => issue.severity === "error"));
}
check(issues("story", "application/pdf").some((issue) => issue.code === "MIME_UNSUPPORTED"));
check(issues("reel", "image/jpeg").some((issue) => issue.code === "MEDIA_TYPE_MISMATCH"));
check(issues("post", "video/mp4").some((issue) => issue.code === "MEDIA_TYPE_MISMATCH"));
check(issues("story", "image/jpeg", "tiktok").some((issue) => issue.code === "FORMAT_UNAVAILABLE"));
check(!issues("video", "video/mp4", "tiktok").some((issue) => issue.severity === "error"));
console.log(`Social capabilities: ${checks} checks passed (pure; no provider call).`);
