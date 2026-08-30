import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/publishing/rate-limit";
import {
  saveAIProvider,
  removeAIProvider,
  testAIProvider,
} from "@/lib/admin/ai-config";
import {
  saveAIProviderSchema,
  removeAIProviderSchema,
  testAIProviderSchema,
} from "@/lib/validators/admin";

export const dynamic = "force-dynamic";

const adminAiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * POST /api/admin/ia
 * Gerencia a configuração central da IA (somente ADMIN).
 *
 * Actions:
 * - { action: "save", provider, apiKey?, model }   → grava chave/modelo (encriptado)
 * - { action: "remove", provider }                 → remove a chave do provider
 * - { action: "test", provider, apiKey?, model }   → testa uma chave SEM gravar
 *
 * Segurança:
 * - Chave NUNCA é devolvida no response — apenas status mascarado.
 * - Valores sensíveis gravados encriptados (AES-256-GCM).
 */
export async function POST(request: Request) {
  // Autorização ADMIN no servidor.
  const { session } = await requireAdminSession();
  const adminId = session.user.id;

  if (!adminAiRateLimiter.check(adminId)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um instante." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;

  try {
    if (action === "save") {
      const parsed = saveAIProviderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
          { status: 400 }
        );
      }
      await saveAIProvider(parsed.data);
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      const parsed = removeAIProviderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
      }
      await removeAIProvider(parsed.data.provider);
      return NextResponse.json({ ok: true });
    }

    if (action === "test") {
      const parsed = testAIProviderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
          { status: 400 }
        );
      }
      const result = await testAIProvider(parsed.data);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    console.error("[admin/ia] erro", err);
    return NextResponse.json(
      { error: "Não foi possível processar a solicitação." },
      { status: 500 }
    );
  }
}
