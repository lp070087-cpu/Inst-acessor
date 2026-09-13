"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUserContext = buildUserContext;
exports.contextToPrompt = contextToPrompt;
const db_1 = require("@/lib/db");
const instagram_data_1 = require("@/lib/dashboard/instagram-data");
const tiktok_data_1 = require("@/lib/dashboard/tiktok-data");
async function buildUserContext(userId) {
    const profile = await db_1.prisma.userProfile.findUnique({ where: { userId } });
    const [ig, tt] = await Promise.all([
        (0, instagram_data_1.getDashboardInstagramData)(userId),
        (0, tiktok_data_1.getTikTokDashboardData)(userId),
    ]);
    return {
        hasProfile: Boolean(profile),
        objective: profile?.objective ?? null,
        niche: profile?.niche ?? null,
        subNiche: profile?.subNiche ?? null,
        displayName: profile?.displayName ?? null,
        instagramConnected: ig.connected,
        tiktokConnected: tt.connected,
        instagram: {
            followers: ig.followersCount,
            media: ig.mediaCount,
            lastSync: ig.lastSyncAt?.toISOString() ?? null,
            snapshotCount: ig.snapshotCount,
        },
        tiktok: {
            followers: tt.followersCount,
            videos: tt.videoCount,
            lastSync: tt.lastSyncAt?.toISOString() ?? null,
            snapshotCount: tt.snapshotCount,
        },
    };
}
/** Converte o contexto em texto legível para o prompt de sistema da IA. */
function contextToPrompt(ctx) {
    const lines = [];
    if (ctx.displayName)
        lines.push(`Usuário: ${ctx.displayName}`);
    if (ctx.niche)
        lines.push(`Nicho: ${ctx.niche}`);
    if (ctx.subNiche)
        lines.push(`Subnicho: ${ctx.subNiche}`);
    if (ctx.objective)
        lines.push(`Objetivo principal: ${ctx.objective}`);
    if (ctx.instagramConnected) {
        lines.push(`Instagram: conectado${ctx.instagram.followers != null ? `, ${ctx.instagram.followers} seguidores` : ""}${ctx.instagram.media != null ? `, ${ctx.instagram.media} publicações` : ""} (${ctx.instagram.snapshotCount} sincronizações).`);
    }
    else {
        lines.push("Instagram: não conectado.");
    }
    if (ctx.tiktokConnected) {
        lines.push(`TikTok: conectado${ctx.tiktok.followers != null ? `, ${ctx.tiktok.followers} seguidores` : ""}${ctx.tiktok.videos != null ? `, ${ctx.tiktok.videos} vídeos` : ""} (${ctx.tiktok.snapshotCount} sincronizações).`);
    }
    else {
        lines.push("TikTok: não conectado.");
    }
    lines.push("Importante: se um dado não estiver listado, ele está indisponível. Não invente métricas.");
    return lines.join("\n");
}
