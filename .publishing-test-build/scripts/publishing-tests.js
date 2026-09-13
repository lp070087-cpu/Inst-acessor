"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const media_1 = require("../src/lib/publishing/media");
let passed = 0;
const failures = [];
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    }
    catch (err) {
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
        assert.strictEqual((0, media_1.isPublicMediaUrl)("https://cdn.example.com/video.mp4"), true);
        assert.strictEqual((0, media_1.isPublicMediaUrl)("http://cdn.example.com/img.jpg"), true);
    });
    test("isPublicMediaUrl rejeita data URL e vazio", () => {
        assert.strictEqual((0, media_1.isPublicMediaUrl)("data:image/jpeg;base64,AAAA"), false);
        assert.strictEqual((0, media_1.isPublicMediaUrl)(""), false);
        assert.strictEqual((0, media_1.isPublicMediaUrl)(null), false);
        assert.strictEqual((0, media_1.isPublicMediaUrl)(undefined), false);
    });
    test("isDataUrl detecta upload local", () => {
        assert.strictEqual((0, media_1.isDataUrl)("data:video/mp4;base64,BBBB"), true);
        assert.strictEqual((0, media_1.isDataUrl)("https://x.com/a.mp4"), false);
    });
    test("extractMediaRefs classifica mídia mista", () => {
        const refs = (0, media_1.extractMediaRefs)({
            mediaUrl: "data:image/jpeg;base64,AAAA",
            mediaItems: [{ mediaUrl: "https://cdn.example.com/1.jpg" }],
        });
        assert.strictEqual(refs.publicPrimary, null);
        assert.strictEqual(refs.publicItems.length, 1);
        assert.strictEqual(refs.hasLocalOnlyMedia, true);
        assert.strictEqual(refs.hasAnyMedia, true);
    });
    test("extractMediaRefs identifica apenas local", () => {
        const refs = (0, media_1.extractMediaRefs)({ mediaUrl: "data:image/png;base64,AAAA" });
        assert.strictEqual(refs.publicPrimary, null);
        assert.strictEqual(refs.publicItems.length, 0);
        assert.strictEqual(refs.hasLocalOnlyMedia, true);
        assert.strictEqual(refs.hasAnyMedia, true);
    });
    test("extractMediaRefs identifica apenas pública", () => {
        const refs = (0, media_1.extractMediaRefs)({ mediaUrl: "https://cdn.example.com/v.mp4" });
        assert.strictEqual(refs.publicPrimary, "https://cdn.example.com/v.mp4");
        assert.strictEqual(refs.hasLocalOnlyMedia, false);
        assert.strictEqual(refs.hasAnyMedia, true);
    });
    test("isVideoMime reconhece vídeo", () => {
        assert.strictEqual((0, media_1.isVideoMime)("video/mp4"), true);
        assert.strictEqual((0, media_1.isVideoMime)("image/jpeg"), false);
        assert.strictEqual((0, media_1.isVideoMime)(undefined), false);
    });
}
// ------------------------------------------------------------
// Legenda / limites
// ------------------------------------------------------------
function captionSection() {
    console.log("\nLegenda e limites");
    test("buildCaption combina caption + hashtags", () => {
        assert.strictEqual((0, media_1.buildCaption)("Olá mundo", "#test #insta", 100), "Olá mundo\n\n#test #insta");
    });
    test("buildCaption respeita limite oficial (trunca por code point)", () => {
        const emoji = "😀".repeat(30); // 30 code points
        const out = (0, media_1.trimToLimit)(emoji, 20);
        assert.strictEqual(Array.from(out).length, 20);
        assert.strictEqual(out, "😀".repeat(20));
    });
    test("buildCaption sem tags usa só o caption", () => {
        assert.strictEqual((0, media_1.buildCaption)("Só caption", "", 100), "Só caption");
    });
    test("trimToLimit preserva conteúdo curto", () => {
        assert.strictEqual((0, media_1.trimToLimit)("curto", 10), "curto");
    });
}
// ------------------------------------------------------------
// Instagram — containers
// ------------------------------------------------------------
function instagramSection() {
    console.log("\nInstagram (containers oficiais)");
    test("post com imagem → IMAGE", () => {
        assert.strictEqual((0, media_1.instagramContainerKind)("post", "image/jpeg"), "IMAGE");
    });
    test("post com vídeo → REELS", () => {
        assert.strictEqual((0, media_1.instagramContainerKind)("post", "video/mp4"), "REELS");
    });
    test("reel/video → REELS; story → STORIES", () => {
        assert.strictEqual((0, media_1.instagramContainerKind)("reel"), "REELS");
        assert.strictEqual((0, media_1.instagramContainerKind)("video"), "REELS");
        assert.strictEqual((0, media_1.instagramContainerKind)("story"), "STORIES");
    });
    test("carrossel → CAROUSEL com children", () => {
        const { children, parent } = (0, media_1.buildInstagramContainers)({
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
        const { children, parent, needsMediaPublish } = (0, media_1.buildInstagramContainers)({
            format: "carrossel",
            mediaItems: [{ mediaUrl: "https://cdn.example.com/1.jpg" }],
        });
        assert.strictEqual(children.length, 0);
        assert.strictEqual(parent, null);
        assert.strictEqual(needsMediaPublish, false);
    });
    test("post único com imagem → container IMAGE", () => {
        const { children, parent } = (0, media_1.buildInstagramContainers)({
            format: "post",
            mediaUrl: "https://cdn.example.com/img.jpg",
            mimeType: "image/jpeg",
        });
        assert.strictEqual(children.length, 0);
        assert.strictEqual(parent?.mediaType, "IMAGE");
        assert.strictEqual(parent?.url, "https://cdn.example.com/img.jpg");
    });
    test("story → STORIES", () => {
        const { parent } = (0, media_1.buildInstagramContainers)({
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
        const body = (0, media_1.buildTikTokPostBody)("Meu vídeo\n\n#fyp", "https://cdn.example.com/v.mp4");
        assert.strictEqual(body.post_info.privacy_level, "PUBLIC_TO_EVERYONE");
        assert.strictEqual(body.post_info.title, "Meu vídeo\n\n#fyp");
        assert.strictEqual(body.source_info.source, "PULL_FROM_URL");
        assert.strictEqual(body.source_info.video_url, "https://cdn.example.com/v.mp4");
    });
    test("buildTikTokPostBody trunca título no limite", () => {
        const long = "x".repeat(3000);
        const body = (0, media_1.buildTikTokPostBody)(long, "https://cdn.example.com/v.mp4");
        assert.strictEqual(Array.from(body.post_info.title).length, 2200);
    });
    test("mapTikTokStatus: só PUBLISH_COMPLETE/PUBLISHED → LIVE", () => {
        assert.strictEqual((0, media_1.mapTikTokStatus)("PUBLISH_COMPLETE"), "LIVE");
        assert.strictEqual((0, media_1.mapTikTokStatus)("PUBLISHED"), "LIVE");
    });
    test("mapTikTokStatus: processando/desconhecido nunca é LIVE", () => {
        assert.strictEqual((0, media_1.mapTikTokStatus)("PROCESSING_UPLOAD"), "PROCESSING");
        assert.strictEqual((0, media_1.mapTikTokStatus)("PROCESSING_DOWNLOAD"), "PROCESSING");
        assert.strictEqual((0, media_1.mapTikTokStatus)("ALGO_DESCONHECIDO"), "PROCESSING");
        assert.strictEqual((0, media_1.mapTikTokStatus)(null), "PROCESSING");
    });
    test("mapTikTokStatus: FAILED → ERROR", () => {
        assert.strictEqual((0, media_1.mapTikTokStatus)("FAILED"), "ERROR");
    });
    test("mapInstagramStatus: só FINISHED → LIVE", () => {
        assert.strictEqual((0, media_1.mapInstagramStatus)("FINISHED"), "LIVE");
    });
    test("mapInstagramStatus: in_progress/expired/erro", () => {
        assert.strictEqual((0, media_1.mapInstagramStatus)("IN_PROGRESS"), "PROCESSING");
        assert.strictEqual((0, media_1.mapInstagramStatus)("EXPIRED"), "ERROR");
        assert.strictEqual((0, media_1.mapInstagramStatus)("ERROR"), "ERROR");
        assert.strictEqual((0, media_1.mapInstagramStatus)(null), "PROCESSING");
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
