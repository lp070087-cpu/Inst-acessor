import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guard";
import {
  saveAIProvider,
  removeAIProvider,
  testAIProvider,
} from "@/lib/admin/ai-config";
import { invalidateRuntimeAICache } from "@/lib/ai/runtime";
import {
  saveAIProviderSchema,
  removeAIProviderSchema,
  testAIProviderSchema,
} from "@/lib/validators/admin";

export const dynamic = "force-dynamic";

/**
 * Verifica se a criptografia de credenciais está pronta para SALVAR.
 * `encryptToken()` exige `TOKEN_ENCRYPTION_KEY` (mín. 32 chars). Sem ela,
 * qualquer SAVE falha com 500 genérico — o que explica o "Não foi possível
 * processar a solicitação." visto no /admin/ia quando o TESTE funciona (o
 * teste não criptografa nada).
 *
 * Retorna apenas um booleano — nunca revela a chave.
 */
function encryptionReady(): boolean {
  const key = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  return key.trim().length >= 32;
}

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
  await requireAdminSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;

  try {
    if (action === "save") {
      // Pre-flight: SAVE criptografa a chave. Sem TOKEN_ENCRYPTION_KEY a gravação
      // é impossível — falha cedo com mensagem acionável em vez de 500 genérico.
      if (!encryptionReady()) {
        return NextResponse.json(
          {
            error:
              "Não foi possível salvar: a variável TOKEN_ENCRYPTION_KEY não está configurada no servidor (mín. 32 caracteres). O teste funciona porque ele não grava nada.",
          },
          { status: 400 }
        );
      }
      const parsed = saveAIProviderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
          { status: 400 }
        );
      }
      await saveAIProvider(parsed.data);
      // A configuração mudou → o runtime (que alimenta IA Acessor, Gerador de
      // Copy e Ideias) precisa reler do banco em vez de usar o cache curto.
      invalidateRuntimeAICache();
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      const parsed = removeAIProviderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
      }
      await removeAIProvider(parsed.data.provider);
      invalidateRuntimeAICache();
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
