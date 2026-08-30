/**
 * CONEXÕES DE REDES SOCIAIS PARA PUBLICAÇÃO REAL
 * ===============================================
 * Leitura segura das credenciais armazenadas (SocialConnection).
 * - Token descriptografado APENAS no servidor (AES-256-GCM).
 * - TikTok token no formato `access|||refresh` → extrai o access token.
 * - Instagram `externalAccountId` guarda o igAccountId (necessário para o
 *   endpoint de media container).
 * - TikTok `externalAccountId` guarda o open_id.
 *
 * NUNCA loga/retorna tokens para a UI.
 */

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export interface PublishConnection {
  ok: true;
  platform: "instagram" | "tiktok";
  accessToken: string;
  /** Instagram: igAccountId. TikTok: open_id. */
  externalAccountId: string;
  connectionId: string;
}

export type ConnectionResolution =
  | PublishConnection
  | { ok: false; reason: "NO_CONNECTION" | "NOT_CONNECTED" | "DECRYPT_FAILED" | "NO_ACCOUNT" };

/**
 * Resolve a conexão ativa do usuário para uma plataforma.
 * Fail-closed: sem conexão, desconectada, sem token, sem conta → não publica.
 */
export async function resolvePublishConnection(
  userId: string,
  platform: "instagram" | "tiktok"
): Promise<ConnectionResolution> {
  const connection = await prisma.socialConnection.findFirst({
    where: { userId, platform },
  });

  if (!connection || !connection.tokenEncrypted) {
    return { ok: false, reason: "NO_CONNECTION" };
  }

  if (connection.status !== "CONNECTED") {
    return { ok: false, reason: "NOT_CONNECTED" };
  }

  // Descriptografa no servidor (nunca vai ao cliente).
  let accessToken: string;
  try {
    const decrypted = decryptToken(connection.tokenEncrypted);
    // TikTok: `access|||refresh` → access token é a primeira parte.
    accessToken = decrypted.split("|||")[0] ?? "";
  } catch {
    return { ok: false, reason: "DECRYPT_FAILED" };
  }

  if (!accessToken) {
    return { ok: false, reason: "DECRYPT_FAILED" };
  }

  const externalAccountId = connection.externalAccountId ?? "";
  if (!externalAccountId) {
    return { ok: false, reason: "NO_ACCOUNT" };
  }

  return {
    ok: true,
    platform,
    accessToken,
    externalAccountId,
    connectionId: connection.id,
  };
}
