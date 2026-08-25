import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { collectTikTokData } from "./metrics";
import { TikTokApiError } from "./client";
import { classifyTikTokError } from "./errors";
import type { TikTokSyncSummary } from "./types";

/**
 * Sincronização dos dados do TikTok.
 * - Descriptografa token SOMENTE no servidor.
 * - Busca dados da API, normaliza, persiste.
 * - Cria snapshot temporal + SyncLog.
 * - Prevenção de sincronizações duplicadas em intervalo curto.
 */

const COOLDOWN_MS = 60 * 1000; // 1 minuto mínimo entre syncs manuais.

export interface TikTokSyncResult {
  ok: boolean;
  summary?: TikTokSyncSummary;
  error?: string;
  code?: string;
}

/**
 * Executa o sync completo para um usuário conectado ao TikTok.
 * @returns resumo seguro (sem tokens).
 */
export async function syncTikTok(userId: string): Promise<TikTokSyncResult> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "tiktok" },
  });

  if (!connection?.tokenEncrypted) {
    return { ok: false, error: "Nenhuma conexão com o TikTok.", code: "no_connection" };
  }

  if (connection.status !== "CONNECTED") {
    return { ok: false, error: "A conexão não está ativa. Reconecte o TikTok.", code: "not_connected" };
  }

  // Cooldown: evita snapshots duplicados em intervalo muito curto.
  const now = Date.now();
  if (connection.lastSyncAt && now - connection.lastSyncAt.getTime() < COOLDOWN_MS) {
    return { ok: false, error: "Sincronização recente. Aguarde um instante.", code: "cooldown" };
  }

  // Descriptografa token no servidor (nunca vai ao cliente).
  let accessToken: string;
  try {
    const decrypted = decryptToken(connection.tokenEncrypted);
    // Formato armazenado: `access|||refresh` (quando há refresh token).
    accessToken = decrypted.split("|||")[0] ?? "";
    if (!accessToken) {
      return { ok: false, error: "Credencial inválida. Reconecte o TikTok.", code: "decrypt" };
    }
  } catch (err) {
    console.error("[tiktok-sync] falha ao descriptografar token", err);
    return { ok: false, error: "Não foi possível ler a credencial armazenada.", code: "decrypt" };
  }

  // open_id é persistido no externalAccountId durante o callback.
  const openId = connection.externalAccountId;
  if (!openId) {
    return { ok: false, error: "Conta TikTok não identificada. Reconecte.", code: "no_connection" };
  }

  const startedAt = Date.now();

  try {
    const data = await collectTikTokData(accessToken, openId);

    // ---- Persiste perfil ----
    const profile = await prisma.tikTokProfile.upsert({
      where: { socialConnectionId: connection.id },
      create: {
        userId,
        socialConnectionId: connection.id,
        tiktokUserId: openId,
        username: data.profile.username ?? null,
        displayName: data.profile.displayName ?? null,
        avatarUrl: data.profile.avatarUrl ?? null,
        followersCount: data.profile.followersCount ?? null,
        followingCount: data.profile.followingCount ?? null,
        videoCount: data.profile.videoCount ?? null,
        likesCount: data.profile.likesCount ?? null,
        bio: data.profile.bio ?? null,
      },
      update: {
        username: data.profile.username ?? null,
        displayName: data.profile.displayName ?? null,
        avatarUrl: data.profile.avatarUrl ?? null,
        followersCount: data.profile.followersCount ?? null,
        followingCount: data.profile.followingCount ?? null,
        videoCount: data.profile.videoCount ?? null,
        likesCount: data.profile.likesCount ?? null,
        bio: data.profile.bio ?? null,
      },
    });

    // ---- Salva snapshot temporal ----
    const snapshot = await prisma.tikTokSnapshot.create({
      data: {
        profileId: profile.id,
        userId,
        capturedAt: new Date(),
        followersCount: data.profile.followersCount ?? null,
        followingCount: data.profile.followingCount ?? null,
        videoCount: data.profile.videoCount ?? null,
        likesCount: data.profile.likesCount ?? null,
        viewsCount: null, // só quando a API fornecer
        profileViews: null,
      },
    });

    // ---- Persiste vídeos ----
    let videosSynced = 0;
    for (const video of data.videos) {
      await prisma.tikTokVideo.upsert({
        where: { tiktokVideoId: video.id },
        create: {
          profileId: profile.id,
          userId,
          tiktokVideoId: video.id,
          title: video.title ?? null,
          coverUrl: video.coverUrl ?? null,
          videoUrl: video.videoUrl ?? null,
          embedUrl: video.embedUrl ?? null,
          likeCount: video.likeCount ?? null,
          commentCount: video.commentCount ?? null,
          shareCount: video.shareCount ?? null,
          playCount: video.playCount ?? null,
          timestamp: video.timestamp ?? null,
        },
        update: {
          title: video.title ?? null,
          coverUrl: video.coverUrl ?? null,
          videoUrl: video.videoUrl ?? null,
          embedUrl: video.embedUrl ?? null,
          likeCount: video.likeCount ?? null,
          commentCount: video.commentCount ?? null,
          shareCount: video.shareCount ?? null,
          playCount: video.playCount ?? null,
          timestamp: video.timestamp ?? null,
        },
      });
      videosSynced++;
    }

    // ---- Atualiza conexão ----
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), status: "CONNECTED" },
    });

    // ---- SyncLog ----
    await prisma.syncLog.create({
      data: {
        userId,
        platform: "tiktok",
        status: "success",
        message: `Sync OK — ${videosSynced} vídeos`,
        itemsSynced: videosSynced + 1,
        durationMs: Date.now() - startedAt,
      },
    });

    return {
      ok: true,
      summary: {
        ok: true,
        syncedAt: new Date().toISOString(),
        profile: {
          username: profile.username,
          followersCount: profile.followersCount,
          videoCount: profile.videoCount,
        },
        videosSynced,
        snapshotId: snapshot.id,
      },
    };
  } catch (err) {
    const info = classifyTikTokError(err);

    // Registra log seguro (sem token).
    await prisma.syncLog.create({
      data: {
        userId,
        platform: "tiktok",
        status: "error",
        message: `Sync falhou: ${info.code}`,
        durationMs: Date.now() - startedAt,
      },
    });

    console.error(`[tiktok-sync] erro (${info.code})`, info.apiCode ?? "");

    return {
      ok: false,
      error: info.userMessage,
      code: info.code,
    };
  }
}

export const TIKTOK_COOLDOWN_MS = COOLDOWN_MS;
