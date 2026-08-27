import { prisma } from "@/lib/db";
import { getDashboardInstagramData } from "@/lib/dashboard/instagram-data";
import { getTikTokDashboardData } from "@/lib/dashboard/tiktok-data";

/**
 * Contexto do usuário para a IA — construído apenas com dados REAIS.
 * Nada de conhecimento inventado. Campos ausentes → omitidos/descritos
 * como indisponíveis.
 */

export interface UserContext {
  hasProfile: boolean;
  objective?: string | null;
  niche?: string | null;
  subNiche?: string | null;
  displayName?: string | null;
  instagramConnected: boolean;
  tiktokConnected: boolean;
  instagram: {
    followers?: number | null;
    media?: number | null;
    lastSync?: string | null;
    snapshotCount: number;
  };
  tiktok: {
    followers?: number | null;
    videos?: number | null;
    lastSync?: string | null;
    snapshotCount: number;
  };
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const [ig, tt] = await Promise.all([
    getDashboardInstagramData(userId),
    getTikTokDashboardData(userId),
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
export function contextToPrompt(ctx: UserContext): string {
  const lines: string[] = [];

  if (ctx.displayName) lines.push(`Usuário: ${ctx.displayName}`);
  if (ctx.niche) lines.push(`Nicho: ${ctx.niche}`);
  if (ctx.subNiche) lines.push(`Subnicho: ${ctx.subNiche}`);
  if (ctx.objective) lines.push(`Objetivo principal: ${ctx.objective}`);

  if (ctx.instagramConnected) {
    lines.push(
      `Instagram: conectado${ctx.instagram.followers != null ? `, ${ctx.instagram.followers} seguidores` : ""}${ctx.instagram.media != null ? `, ${ctx.instagram.media} publicações` : ""} (${ctx.instagram.snapshotCount} sincronizações).`
    );
  } else {
    lines.push("Instagram: não conectado.");
  }

  if (ctx.tiktokConnected) {
    lines.push(
      `TikTok: conectado${ctx.tiktok.followers != null ? `, ${ctx.tiktok.followers} seguidores` : ""}${ctx.tiktok.videos != null ? `, ${ctx.tiktok.videos} vídeos` : ""} (${ctx.tiktok.snapshotCount} sincronizações).`
    );
  } else {
    lines.push("TikTok: não conectado.");
  }

  lines.push(
    "Importante: se um dado não estiver listado, ele está indisponível. Não invente métricas."
  );

  return lines.join("\n");
}
