import { withPremiumApi } from "@/lib/auth/premium-api";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getLearnedProfile } from "@/lib/ai/services";
import { updateAIProfile, AI_PROFILE_WRITABLE_FIELDS } from "@/lib/ai/services";
import type { AIProfileWritableField } from "@/lib/ai/services";

export const dynamic = "force-dynamic";

/**
 * PERFIL DE INTELIGÊNCIA — leitura e correção ("A IA aprendeu sobre você")
 * ========================================================================
 *   GET   /api/ai/profile  → monta os cards a partir de dados REAIS do usuário
 *   PATCH /api/ai/profile  → corrige campos de AIProfile (persistido)
 *
 * Segurança: SEMPRE `requireSession()` e SEMPRE escopado por
 * `session.user.id`. O corpo da requisição nunca traz `userId` — um usuário
 * jamais lê nem grava o perfil de outro.
 */

/** Teto por campo — mesmo limite usado na camada de serviço. */
const MAXLEN: Record<AIProfileWritableField, number> = {
  summary: 2000,
  niche: 200,
  subNiche: 200,
  objectives: 300,
  communicationStyle: 300,
  observedPatterns: 1200,
  preferredFormats: 300,
  ctaPatterns: 300,
  hookPatterns: 300,
  postingFrequency: 200,
  voiceTone: 200,
  writingStyle: 300,
  notes: 1000,
};

async function GETHandler() {
  try {
    const session = await requireSession();
    const data = await getLearnedProfile(session.user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[ai/profile] GET erro", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o perfil aprendido." },
      { status: 500 }
    );
  }
}

async function PATCHHandler(request: Request) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
    }

    const patch: Partial<Record<AIProfileWritableField, string>> = {};
    for (const field of AI_PROFILE_WRITABLE_FIELDS) {
      const raw = body[field];
      if (raw === undefined) continue;
      if (typeof raw !== "string") {
        return NextResponse.json({ error: `campo inválido: ${field}` }, { status: 400 });
      }
      if (raw.length > MAXLEN[field]) {
        return NextResponse.json(
          { error: `“${field}” excede o tamanho máximo permitido.` },
          { status: 400 }
        );
      }
      patch[field] = raw;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
    }

    const profile = await updateAIProfile(userId, patch);
    return NextResponse.json({ ok: true, profile, data: await getLearnedProfile(userId) });
  } catch (err) {
    console.error("[ai/profile] PATCH erro", err);
    return NextResponse.json(
      { error: "Não foi possível salvar a correção." },
      { status: 500 }
    );
  }
}

export const GET = withPremiumApi(GETHandler);

export const PATCH = withPremiumApi(PATCHHandler);
