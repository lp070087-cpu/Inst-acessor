import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getDisplayNameInfo, setDisplayNameSource } from "@/lib/gamification";
import type { DisplayNameSource } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * Nome exibido no Rank (rodada #274):
 *   GET  /api/rank/display-name → resolve a preferência atual (com fallback)
 *   PATCH /api/rank/display-name → grava a preferência ("profile" | "instagram")
 *
 * Segurança: sessão obrigatória; apenas o próprio usuário lê/grava a própria
 * preferência. A preferência é armazenada no JSON `UserPreferences.dashboard`
 * (SEM mudança de schema). Nenhum segredo trafega.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const info = await getDisplayNameInfo(userId);
    return NextResponse.json({ displayName: info });
  } catch (err) {
    console.error("[rank/display-name] erro ao ler", err);
    return NextResponse.json({ error: "Não foi possível ler o nome exibido." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const source = body?.source;
    if (source !== "profile" && source !== "instagram") {
      return NextResponse.json({ error: "Origem inválida (use \"profile\" ou \"instagram\")." }, { status: 400 });
    }

    await setDisplayNameSource(userId, source as DisplayNameSource);
    const info = await getDisplayNameInfo(userId);
    return NextResponse.json({ ok: true, displayName: info });
  } catch (err) {
    console.error("[rank/display-name] erro ao gravar", err);
    return NextResponse.json({ error: "Não foi possível atualizar o nome exibido." }, { status: 500 });
  }
}
