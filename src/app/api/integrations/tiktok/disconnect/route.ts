import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Desconecta o TikTok do usuário autenticado.
 * - Exige sessão.
 * - Invalida/remove a credencial armazenada (token encriptado).
 * - Atualiza status para DISCONNECTED.
 * - NÃO apaga histórico de métricas (regra de produto).
 * - Só altera a conexão do próprio usuário (userId da sessão).
 */
export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const result = await prisma.socialConnection.updateMany({
      where: { userId, platform: "tiktok" },
      data: {
        status: "DISCONNECTED",
        tokenEncrypted: null,
        tokenExpiresAt: null,
        scopes: null,
        lastSyncAt: null,
        externalAccountId: null,
        username: null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ ok: true, disconnected: true });
    }

    console.info(`[tiktok-disconnect] conexão removida para user=${userId}`);
    return NextResponse.json({ ok: true, disconnected: true });
  } catch (error) {
    console.error("[tiktok-disconnect] erro", error instanceof Error ? error.message : "desconhecido");
    return NextResponse.json(
      { error: "Não foi possível desconectar. Tente novamente." },
      { status: 500 }
    );
  }
}
