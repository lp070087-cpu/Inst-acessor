import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { countDirect } from "@/lib/comment-direct/db";
import {
  canManageComments,
  canManageMessages,
  MISSING_MESSAGES_PERMISSION_NOTICE,
  permissionState,
  SCOPE_MANAGE_MESSAGES,
} from "@/lib/comment-direct/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/comment-direct/status
 *
 * Estado REAL da integração, lido do banco (não de suposição):
 *   - conexão do Instagram e seu status;
 *   - se a permissão de MENSAGENS foi concedida (escopo persistido);
 *   - se a de COMENTÁRIOS foi concedida;
 *   - contadores do que existe persistido.
 *
 * A UI usa isto para escolher entre a tela real e o estado "integração
 * pendente". NUNCA devolve token nem escopo cru ao cliente além do necessário.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const connection = await prisma.socialConnection.findFirst({
      where: { userId, platform: "instagram" },
      select: { status: true, username: true, scopes: true, lastSyncAt: true },
    });

    const connected = connection?.status === "CONNECTED";

    const messagesPermission = permissionState(connection?.scopes, SCOPE_MANAGE_MESSAGES);
    const commentsPermission = canManageComments(connection?.scopes) ? "granted" : "missing";

    const counts = await countDirect(userId).catch(() => ({
      rules: 0,
      conversations: 0,
      faqs: 0,
    }));

    return NextResponse.json({
      connected,
      username: connection?.username ?? null,
      lastSyncAt: connection?.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
      // Estado explícito da permissão de mensagens: 'granted' | 'missing' | 'unknown'.
      messagesPermission,
      canManageMessages: connection ? canManageMessages(connection.scopes) : false,
      commentsPermission,
      // Frase de produto quando a permissão está pendente (sem jargão).
      pendingNotice:
        connected && !canManageMessages(connection?.scopes)
          ? MISSING_MESSAGES_PERMISSION_NOTICE
          : null,
      counts,
    });
  } catch (err) {
    console.error("[comment-direct/status] erro", err);
    return NextResponse.json({ error: "Não foi possível carregar o estado da integração." }, { status: 500 });
  }
}
