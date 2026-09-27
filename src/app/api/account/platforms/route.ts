import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import {
  getPlatformSelection,
  setPlatformSelection,
  PLATFORM_SELECTIONS,
} from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * PLATAFORMAS ACOMPANHADAS (item 5)
 *   GET   /api/account/platforms → preferência atual ("instagram"|"tiktok"|"both")
 *   PATCH /api/account/platforms → grava a preferência
 *
 * Segurança: sessão obrigatória; cada usuário lê/grava SÓ a própria
 * preferência. Nada de segredo trafega e nenhuma credencial de rede é tocada —
 * é uma preferência de exibição gravada no JSON `UserPreferences.dashboard`
 * (SEM mudança de schema), igual ao `displayNameSource` da rodada #274.
 *
 * Escolher uma plataforma NÃO desconecta nem apaga nada: as redes conectadas,
 * o Score e o histórico continuam intactos. Quem filtra é a tela de Conquistas.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const selection = await getPlatformSelection(session.user.id);
    return NextResponse.json({ selection, options: PLATFORM_SELECTIONS });
  } catch (err) {
    console.error("[account/platforms] erro ao ler", err);
    return NextResponse.json(
      { error: "Não foi possível ler suas plataformas." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const selection = body?.selection;
    if (
      typeof selection !== "string" ||
      !(PLATFORM_SELECTIONS as readonly string[]).includes(selection)
    ) {
      return NextResponse.json(
        { error: 'Seleção inválida (use "instagram", "tiktok" ou "both").' },
        { status: 400 }
      );
    }

    const saved = await setPlatformSelection(
      session.user.id,
      selection as (typeof PLATFORM_SELECTIONS)[number]
    );
    // Devolve o valor REALMENTE gravado, para a tela revalidar na fonte.
    return NextResponse.json({ ok: true, selection: saved });
  } catch (err) {
    console.error("[account/platforms] erro ao gravar", err);
    return NextResponse.json(
      { error: "Não foi possível salvar suas plataformas." },
      { status: 500 }
    );
  }
}
