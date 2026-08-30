/**
 * TESTES DETERMINÍSTICOS — PUBLICAÇÃO REAL (Fase atual)
 * ======================================================
 * Testa a lógica PURA da publicação real (SEM rede nem banco):
 *   - mídia: URL pública vs data URL local (honestidade — nunca inventar)
 *   - legenda/hashtags com limites oficiais (truncamento por code point)
 *   - containers do Instagram (post/carrossel/reel/story)
 *   - corpo oficial do TikTok (Content Posting API)
 *   - mapeamento de status oficial → estado interno (nunca LIVE sem confirmação)
 *
 * Para rodar: npm run publishing:test
 * (Não usa vitest/jest — depende apenas de Node + assert.)
 */

import * as assert from "node:assert";
import {
  isPublicMediaUrl,
  isDataUrl,
  extractMediaRefs,
  trimToLimit,
  buildCaption,
  instagramContainerKind,
  buildInstagramContainers,
  buildTikTokPostBody,
  mapTikTokStatus,
  mapInstagramStatus,
  isVideoMime,
} from "../src/lib/publishing/media";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ❌ ${name}`);
    console.error(`     ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ------------------------------------------------------------
// Mídia
// ------------------------------------------------------------

function mediaSection() {
  console.log("\nMídia (URL pública vs local)");

  test("isPublicMediaUrl reconhece http/https", () => {
    assert.strictEqual(isPublicMediaUrl("https://cdn.example.com/video.mp4"), true);
    assert.strictEqual(isPublicMediaUrl("http://cdn.example.com/img.jpg"), true);
  });

  test("isPublicMediaUrl rejeita data URL e vazio", () => {
    assert.strictEqual(isPublicMediaUrl("data:image/jpeg;base64,AAAA"), false);
    assert.strictEqual(isPublicMediaUrl(""), false);
    assert.strictEqual(isPublicMediaUrl(null), false);
    assert.strictEqual(isPublicMediaUrl(undefined), false);
  });

  test("isDataUrl detecta upload local", () => {
    assert.strictEqual(isDataUrl("data:video/mp4;base64,BBBB"), true);
    assert.strictEqual(isDataUrl("https://x.com/a.mp4"), false);
  });

  test("extractMediaRefs classifica mídia mista", () => {
    const refs = extractMediaRefs({
      mediaUrl: "data:image/jpeg;base64,AAAA",
      mediaItems: [{ mediaUrl: "https://cdn.example.com/1.jpg" }],
    });
    assert.strictEqual(refs.publicPrimary, null);
    assert.strictEqual(refs.publicItems.length, 1);
    assert.strictEqual(refs.hasLocalOnlyMedia, true);
    assert.strictEqual(refs.hasAnyMedia, true);
  });

  test("extractMediaRefs identifica apenas local", () => {
    const refs = extractMediaRefs({ mediaUrl: "data:image/png;base64,AAAA" });
    assert.strictEqual(refs.publicPrimary, null);
    assert.strictEqual(refs.publicItems.length, 0);
    assert.strictEqual(refs.hasLocalOnlyMedia, true);
    assert.strictEqual(refs.hasAnyMedia, true);
  });

  test("extractMediaRefs identifica apenas pública", () => {
    const refs = extractMediaRefs({ mediaUrl: "https://cdn.example.com/v.mp4" });
    assert.strictEqual(refs.publicPrimary, "https://cdn.example.com/v.mp4");
    assert.strictEqual(refs.hasLocalOnlyMedia, false);
    assert.strictEqual(refs.hasAnyMedia, true);
  });

  test("isVideoMime reconhece vídeo", () => {
    assert.strictEqual(isVideoMime("video/mp4"), true);
    assert.strictEqual(isVideoMime("image/jpeg"), false);
    assert.strictEqual(isVideoMime(undefined), false);
  });
}

// ------------------------------------------------------------
// Legenda / limites
// ------------------------------------------------------------

function captionSection() {
  console.log("\nLegenda e limites");

  test("buildCaption combina caption + hashtags", () => {
    assert.strictEqual(
      buildCaption("Olá mundo", "#test #insta", 100),
      "Olá mundo\n\n#test #insta"
    );
  });

  test("buildCaption respeita limite oficial (trunca por code point)", () => {
    const emoji = "😀".repeat(30); // 30 code points
    const out = trimToLimit(emoji, 20);
    assert.strictEqual(Array.from(out).length, 20);
    assert.strictEqual(out, "😀".repeat(20));
  });

  test("buildCaption sem tags usa só o caption", () => {
    assert.strictEqual(buildCaption("Só caption", "", 100), "Só caption");
  });

  test("trimToLimit preserva conteúdo curto", () => {
    assert.strictEqual(trimToLimit("curto", 10), "curto");
  });
}

// ------------------------------------------------------------
// Instagram — containers
// ------------------------------------------------------------

function instagramSection() {
  console.log("\nInstagram (containers oficiais)");

  test("post com imagem → IMAGE", () => {
    assert.strictEqual(instagramContainerKind("post", "image/jpeg"), "IMAGE");
  });

  test("post com vídeo → REELS", () => {
    assert.strictEqual(instagramContainerKind("post", "video/mp4"), "REELS");
  });

  test("reel/video → REELS; story → STORIES", () => {
    assert.strictEqual(instagramContainerKind("reel"), "REELS");
    assert.strictEqual(instagramContainerKind("video"), "REELS");
    assert.strictEqual(instagramContainerKind("story"), "STORIES");
  });

  test("carrossel → CAROUSEL com children", () => {
    const { children, parent } = buildInstagramContainers({
      format: "carrossel",
      mediaItems: [
        { mediaUrl: "https://cdn.example.com/1.jpg", mimeType: "image/jpeg" },
        { mediaUrl: "https://cdn.example.com/2.jpg", mimeType: "image/jpeg" },
      ],
    });
    assert.strictEqual(parent?.mediaType, "CAROUSEL");
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]?.isCarouselItem, true);
  });

  test("carrossel com 1 item → não monta (precisa >= 2)", () => {
    const { children, parent, needsMediaPublish } = buildInstagramContainers({
      format: "carrossel",
      mediaItems: [{ mediaUrl: "https://cdn.example.com/1.jpg" }],
    });
    assert.strictEqual(children.length, 0);
    assert.strictEqual(parent, null);
    assert.strictEqual(needsMediaPublish, false);
  });

  test("post único com imagem → container IMAGE", () => {
    const { children, parent } = buildInstagramContainers({
      format: "post",
      mediaUrl: "https://cdn.example.com/img.jpg",
      mimeType: "image/jpeg",
    });
    assert.strictEqual(children.length, 0);
    assert.strictEqual(parent?.mediaType, "IMAGE");
    assert.strictEqual(parent?.url, "https://cdn.example.com/img.jpg");
  });

  test("story → STORIES", () => {
    const { parent } = buildInstagramContainers({
      format: "story",
      mediaUrl: "https://cdn.example.com/story.jpg",
      mimeType: "image/jpeg",
    });
    assert.strictEqual(parent?.mediaType, "STORIES");
  });
}

// ------------------------------------------------------------
// TikTok — corpo oficial + status
// ------------------------------------------------------------

function tiktokSection() {
  console.log("\nTikTok (Content Posting API)");

  test("buildTikTokPostBody monta corpo oficial", () => {
    const body = buildTikTokPostBody("Meu vídeo\n\n#fyp", "https://cdn.example.com/v.mp4");
    assert.strictEqual(body.post_info.privacy_level, "PUBLIC_TO_EVERYONE");
    assert.strictEqual(body.post_info.title, "Meu vídeo\n\n#fyp");
    assert.strictEqual(body.source_info.source, "PULL_FROM_URL");
    assert.strictEqual(body.source_info.video_url, "https://cdn.example.com/v.mp4");
  });

  test("buildTikTokPostBody trunca título no limite", () => {
    const long = "x".repeat(3000);
    const body = buildTikTokPostBody(long, "https://cdn.example.com/v.mp4");
    assert.strictEqual(Array.from(body.post_info.title).length, 2200);
  });

  test("mapTikTokStatus: só PUBLISH_COMPLETE/PUBLISHED → LIVE", () => {
    assert.strictEqual(mapTikTokStatus("PUBLISH_COMPLETE"), "LIVE");
    assert.strictEqual(mapTikTokStatus("PUBLISHED"), "LIVE");
  });

  test("mapTikTokStatus: processando/desconhecido nunca é LIVE", () => {
    assert.strictEqual(mapTikTokStatus("PROCESSING_UPLOAD"), "PROCESSING");
    assert.strictEqual(mapTikTokStatus("PROCESSING_DOWNLOAD"), "PROCESSING");
    assert.strictEqual(mapTikTokStatus("ALGO_DESCONHECIDO"), "PROCESSING");
    assert.strictEqual(mapTikTokStatus(null), "PROCESSING");
  });

  test("mapTikTokStatus: FAILED → ERROR", () => {
    assert.strictEqual(mapTikTokStatus("FAILED"), "ERROR");
  });

  test("mapInstagramStatus: só FINISHED → LIVE", () => {
    assert.strictEqual(mapInstagramStatus("FINISHED"), "LIVE");
  });

  test("mapInstagramStatus: in_progress/expired/erro", () => {
    assert.strictEqual(mapInstagramStatus("IN_PROGRESS"), "PROCESSING");
    assert.strictEqual(mapInstagramStatus("EXPIRED"), "ERROR");
    assert.strictEqual(mapInstagramStatus("ERROR"), "ERROR");
    assert.strictEqual(mapInstagramStatus(null), "PROCESSING");
  });
}

// ------------------------------------------------------------

mediaSection();
captionSection();
instagramSection();
tiktokSection();

console.log(`\n${passed} testes passando, ${failures.length} falhas.`);
if (failures.length > 0) {
  console.error(`Falhas: ${failures.join(", ")}`);
  process.exit(1);
}
