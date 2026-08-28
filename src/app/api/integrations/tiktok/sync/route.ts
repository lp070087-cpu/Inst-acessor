import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { syncTikTok } from "@/lib/integrations/tiktok";
import { syncRateLimiter } from "@/lib/publishing/rate-limit";
import { grantXp, checkAndUnlockAchievements } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * Sincroniza os dados do TikTok do usuário autenticado.
 * Fluxo todo no servidor: valida sessão → sync (token nunca vai ao cliente).
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

  if (!syncRateLimiter.check(userId)) {
    return NextResponse.json(
      { error: "Muitas sincronizações. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  const result = await syncTikTok(userId);

  if (!result.ok) {
    if (result.code === "cooldown") {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 429 });
    }
    const status =
      result.code === "no_connection" || result.code === "not_connected"
        ? 400
        : result.code === "token_invalid"
          ? 401
          : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  // XP por sincronizar TikTok (idempotente por refId = snapshot id).
  const snapshotId = result.summary?.snapshotId;
  if (snapshotId) {
    await grantXp(userId, "sincronizar-tiktok", snapshotId);
    await checkAndUnlockAchievements(userId);
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}
