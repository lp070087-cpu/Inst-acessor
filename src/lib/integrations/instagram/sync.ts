import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { collectInstagramData } from "./metrics";
import { InstagramApiError } from "./client";
import { classifyIntegrationError } from "./errors";
import type { InstagramSyncSummary } from "./types";

/**
 * Sincronização dos dados do Instagram.
 * - Descriptografa token SOMENTE no servidor.
 * - Busca dados da API, normaliza, persiste.
 * - Cria snapshot temporal + SyncLog.
 * - Prevenção de sincronizações duplicadas em intervalo curto.
 */

const COOLDOWN_MS = 60 * 1000; // 1 minuto mínimo entre syncs manuais.

export interface SyncResult {
  ok: boolean;
  summary?: InstagramSyncSummary;
  error?: string;
  code?: string;
}

/**
 * Executa o sync completo para um usuário conectado.
 * @returns resumo seguro (sem tokens).
 */
export async function syncInstagram(userId: string): Promise<SyncResult> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform: "instagram" },
  });

  if (!connection?.tokenEncrypted) {
    return { ok: false, error: "Nenhuma conexão com o Instagram.", code: "no_connection" };
  }

  if (connection.status !== "CONNECTED") {
    return { ok: false, error: "A conexão não está ativa. Reconecte o Instagram.", code: "not_connected" };
  }

  // Cooldown: evita snapshots duplicados em intervalo muito curto.
  const now = Date.now();
  if (connection.lastSyncAt && now - connection.lastSyncAt.getTime() < COOLDOWN_MS) {
    return { ok: false, error: "Sincronização recente. Aguarde um instante.", code: "cooldown" };
  }

  // Descriptografa token no servidor (nunca vai ao cliente).
  let accessToken: string;
  try {
    accessToken = decryptToken(connection.tokenEncrypted);
  } catch (err) {
    console.error("[instagram-sync] falha ao descriptografar token", err);
    return { ok: false, error: "Não foi possível ler a credencial armazenada.", code: "decrypt" };
  }

  const startedAt = Date.now();

  try {
    const data = await collectInstagramData(accessToken);

    // ---- Persiste perfil ----
    const profile = await prisma.instagramProfile.upsert({
      where: { socialConnectionId: connection.id },
      create: {
        userId,
        socialConnectionId: connection.id,
        igAccountId: data.account.id,
        username: data.profile.username ?? data.account.username,
        name: data.profile.name ?? null,
        followersCount: data.profile.followersCount ?? null,
        followsCount: data.profile.followsCount ?? null,
        mediaCount: data.profile.mediaCount ?? null,
        profilePictureUrl: data.profile.profilePictureUrl ?? null,
        biography: data.profile.biography ?? null,
      },
      update: {
        username: data.profile.username ?? data.account.username,
        name: data.profile.name ?? null,
        followersCount: data.profile.followersCount ?? null,
        followsCount: data.profile.followsCount ?? null,
        mediaCount: data.profile.mediaCount ?? null,
        profilePictureUrl: data.profile.profilePictureUrl ?? null,
        biography: data.profile.biography ?? null,
      },
    });

    // ---- Salva snapshot temporal ----
    const snapshot = await prisma.instagramSnapshot.create({
      data: {
        profileId: profile.id,
        userId,
        capturedAt: new Date(),
        followersCount: data.profile.followersCount ?? null,
        followsCount: data.profile.followsCount ?? null,
        mediaCount: data.profile.mediaCount ?? null,
        reach: data.insights.reach ?? null,
        impressions: data.insights.impressions ?? null,
        profileViews: data.insights.profileViews ?? null,
        // Engajamento: derivado apenas quando houver componentes reais.
        engagement: null,
      },
    });

    // ---- Persiste mídias + métricas + comentários ----
    let mediaSynced = 0;
    let commentsSynced = 0;

    for (const media of data.medias) {
      // Idempotência: a chave é o ID externo da Meta (`igMediaId`). Sincronizar
      // duas vezes ATUALIZA o mesmo registro — nunca duplica publicação.
      const saved = await prisma.instagramMedia.upsert({
        where: { igMediaId: media.id },
        create: {
          profileId: profile.id,
          userId,
          igMediaId: media.id,
          mediaType: media.mediaType ?? null,
          mediaProductType: media.mediaProductType ?? null,
          permalink: media.permalink ?? null,
          caption: media.caption ?? null,
          timestamp: media.timestamp ?? null,
          likeCount: media.likeCount ?? null,
          commentsCount: media.commentsCount ?? null,
          mediaUrl: media.mediaUrl ?? null,
          thumbnailUrl: media.thumbnailUrl ?? null,
        },
        update: {
          mediaType: media.mediaType ?? null,
          mediaProductType: media.mediaProductType ?? null,
          permalink: media.permalink ?? null,
          caption: media.caption ?? null,
          timestamp: media.timestamp ?? null,
          likeCount: media.likeCount ?? null,
          commentsCount: media.commentsCount ?? null,
          mediaUrl: media.mediaUrl ?? null,
          thumbnailUrl: media.thumbnailUrl ?? null,
        },
      });

      // Métricas: um registro por mídia (upsert por `mediaId`, que é único).
      // Antes era `create` a cada sync — cada sincronização criava uma linha
      // nova com o mesmo dado, inflando a tabela sem motivo.
      if (media.metrics) {
        await prisma.instagramMediaMetric.upsert({
          where: { mediaId: saved.id },
          create: {
            mediaId: saved.id,
            userId,
            igMediaId: media.id,
            reached: media.metrics.reached ?? null,
            impressions: media.metrics.impressions ?? null,
            shares: media.metrics.shares ?? null,
            saves: media.metrics.saves ?? null,
            comments: media.metrics.comments ?? null,
            likes: media.metrics.likes ?? null,
            videoViews: media.metrics.video_views ?? null,
            videoViewTime: media.metrics.video_view_time ?? null,
            capturedAt: new Date(),
          },
          update: {
            reached: media.metrics.reached ?? null,
            impressions: media.metrics.impressions ?? null,
            shares: media.metrics.shares ?? null,
            saves: media.metrics.saves ?? null,
            comments: media.metrics.comments ?? null,
            likes: media.metrics.likes ?? null,
            videoViews: media.metrics.video_views ?? null,
            videoViewTime: media.metrics.video_view_time ?? null,
            capturedAt: new Date(),
          },
        });
      }

      // Comentários REAIS: só persiste quando a leitura funcionou. `null`
      // significa "não foi possível ler" — nesse caso NÃO apagamos nada, para
      // não destruir comentários já sincronizados por uma falha de permissão.
      if (media.comments !== null && media.comments !== undefined) {
        for (const comment of media.comments) {
          await prisma.instagramComment.upsert({
            where: { igCommentId: comment.id },
            create: {
              userId,
              mediaId: saved.id,
              igCommentId: comment.id,
              authorUsername: comment.authorUsername ?? null,
              authorId: comment.authorId ?? null,
              text: comment.text ?? null,
              timestamp: comment.timestamp ?? null,
              isOwn: comment.isOwn ?? false,
              repliesCount: comment.repliesCount ?? null,
              syncedAt: new Date(),
            },
            update: {
              authorUsername: comment.authorUsername ?? null,
              authorId: comment.authorId ?? null,
              text: comment.text ?? null,
              timestamp: comment.timestamp ?? null,
              isOwn: comment.isOwn ?? false,
              repliesCount: comment.repliesCount ?? null,
              syncedAt: new Date(),
            },
          });
          commentsSynced++;
        }
      }

      mediaSynced++;
    }

    // ---- Atualiza conexão ----
    const syncedAt = new Date();
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: syncedAt,
        lastSyncAttemptAt: syncedAt,
        lastSyncErrorCode: null,
        status: "CONNECTED",
        // Capacidade REAL de leitura de comentários nesta execução (tristate:
        // true = lemos, false = a Meta recusou, null = nada a ler).
        commentsAvailable: data.commentsAvailable ?? null,
        commentsErrorCode: data.commentsErrorCode ?? null,
      },
    });

    // ---- SyncLog ----
    await prisma.syncLog.create({
      data: {
        userId,
        platform: "instagram",
        status: "success",
        message: `Sync OK — ${mediaSynced} mídias, ${commentsSynced} comentários`,
        itemsSynced: mediaSynced + commentsSynced + 1,
        durationMs: Date.now() - startedAt,
      },
    });

    return {
      ok: true,
      summary: {
        ok: true,
        syncedAt: syncedAt.toISOString(),
        profile: {
          username: profile.username,
          followersCount: profile.followersCount,
          mediaCount: profile.mediaCount,
        },
        insights: data.insights,
        mediaSynced,
        commentsSynced,
        commentsAvailable: data.commentsAvailable ?? null,
        snapshotId: snapshot.id,
      },
    };
  } catch (err) {
    const info = classifyIntegrationError(err);
    const failedAt = new Date();

    // Registra a TENTATIVA (mesmo falhando) — sem isso, uma conta com token
    // expirado parece apenas "nunca sincronizada".
    await prisma.socialConnection
      .update({
        where: { id: connection.id },
        data: {
          lastSyncAttemptAt: failedAt,
          lastSyncErrorCode: String(info.metaCode ?? info.code),
        },
      })
      .catch(() => {
        /* o registro da tentativa é best-effort — não esconde o erro real */
      });

    // Registra log seguro (sem token).
    await prisma.syncLog.create({
      data: {
        userId,
        platform: "instagram",
        status: "error",
        message: `Sync falhou: ${info.code}`,
        durationMs: Date.now() - startedAt,
      },
    });

    console.error(`[instagram-sync] erro (${info.code})`, info.metaCode ?? "");

    return {
      ok: false,
      error: info.userMessage,
      code: info.code,
    };
  }
}

export const INSTAGRAM_COOLDOWN_MS = COOLDOWN_MS;
