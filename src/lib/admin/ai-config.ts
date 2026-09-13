import { settings } from "@/lib/admin/settings-db";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { invalidateRuntimeAICache } from "@/lib/ai/runtime";
import {
  AI_PROVIDER_KEY,
  AI_OPENAI_KEY,
  AI_OPENAI_MODEL,
  AI_GEMINI_KEY,
  AI_GEMINI_MODEL,
  OPENAI_MODELS,
  GEMINI_MODELS,
  AI_OPENAI_DEFAULT_MODEL,
  AI_GEMINI_DEFAULT_MODEL,
  parseModel,
} from "@/lib/ai/settings-keys";

/**
 * ADMIN — Configuração central da IA (Fase 10)
 * =============================================
 *
 * A configuração da IA é feita APENAS pela área administrativa (ADMIN).
 * Clientes nunca configuram chave de API.
 *
 * Modelo de persistência:
 * - `ai.provider`        → "openai" | "gemini" | "" (vazio = sem IA)
 * - `ai.openai.key`      → chave ENCRIPITADA (AES-256-GCM) + sufixo
 * - `ai.openai.model`    → "gpt-4o-mini" (padrão oficial)
 * - `ai.gemini.key`      → chave ENCRIPITADA (AES-256-GCM) + sufixo
 * - `ai.gemini.model`    → "gemini-1.5-flash" (padrão oficial)
 *
 * Segurança:
 * - Chave NUNCA é devolvida ao frontend; apenas o sufixo mascarado
 *   (ex.: `sk-••••••••••••abcd`).
 * - Valores sensíveis são gravados encriptados; nunca em texto puro.
 * - Provider ativo para o RUNTIME continua lido das env vars
 *   (OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY). Esta camada admin
 *   é a FONTE DE VERDADE quando o DONO grava por aqui — quando o DONO salva
 *   uma chave, ela passa a valer para `aiConfigured()`/`getAIProvider()`.
 *
 * ⚠️ A DONA DEVE rodar `npx prisma generate` localmente para o client
 * reconhecer o model SystemSetting.
 */

// ------------------------------------------------------------
// Chaves oficiais — re-exportadas de `@/lib/ai/settings-keys`
// (arquivo-folha compartilhado com o runtime, sem ciclo de importação)
// ------------------------------------------------------------
export {
  AI_PROVIDER_KEY,
  AI_OPENAI_KEY,
  AI_OPENAI_MODEL,
  AI_GEMINI_KEY,
  AI_GEMINI_MODEL,
  OPENAI_MODELS,
  GEMINI_MODELS,
};

export type AIProviderName = "openai" | "gemini";
export type AIModelChoice = "gpt-4o-mini" | "gpt-4o" | "gemini-1.5-flash" | "gemini-1.5-pro";

export interface AIProviderStatus {
  configured: boolean;
  provider: AIProviderName;
  model: AIModelChoice | "";
  /** Sufixo mascarado da chave (nunca a chave completa). */
  keyMask: string;
  /** Fonte da configuração: "db" (admin) | "env" (variável de ambiente). */
  source: "db" | "env";
}

// ------------------------------------------------------------
// Helpers de leitura (server-only)
// ------------------------------------------------------------

/** Mascara uma chave: `sk-••••••••••••abcd` — nunca expõe o valor. */
function maskKey(key: string): string {
  if (!key) return "";
  const clean = key.trim();
  if (clean.length <= 8) return "••••••••";
  const head = clean.slice(0, 3);
  const tail = clean.slice(-4);
  return `${head}-••••••••••••${tail}`;
}

async function getSetting(key: string): Promise<string | null> {
  const row = await settings.systemSetting.findUnique({ where: { key } });
  if (!row) return null;
  return (row as { value: string }).value;
}

async function setSetting(key: string, value: string): Promise<void> {
  const existing = await settings.systemSetting.findUnique({ where: { key } });
  if (existing) {
    await settings.systemSetting.update({ where: { id: (existing as { id: string }).id }, data: { value } });
  } else {
    await settings.systemSetting.create({ data: { key, value } });
  }
}

async function removeSetting(key: string): Promise<void> {
  await settings.systemSetting.deleteMany({ where: { key } });
}

// ------------------------------------------------------------
// Estado da IA — lê DB + env (nunca expõe a chave)
// ------------------------------------------------------------

export async function getAIAdminStatus(): Promise<{
  openai: AIProviderStatus;
  gemini: AIProviderStatus;
  activeProvider: AIProviderName | "";
  aiConfigured: boolean;
}> {
  const [provider, openaiKeyEnc, openaiModel, geminiKeyEnc, geminiModel] = await Promise.all([
    getSetting(AI_PROVIDER_KEY),
    getSetting(AI_OPENAI_KEY),
    getSetting(AI_OPENAI_MODEL),
    getSetting(AI_GEMINI_KEY),
    getSetting(AI_GEMINI_MODEL),
  ]);

  // Se o DONO gravou uma chave no admin, ela é a fonte de verdade.
  const openaiKey = openaiKeyEnc ? decryptToken(openaiKeyEnc) : process.env.OPENAI_API_KEY ?? "";
  const geminiKey = geminiKeyEnc
    ? decryptToken(geminiKeyEnc)
    : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

  const openaiConfigured = Boolean(openaiKey);
  const geminiConfigured = Boolean(geminiKey);

  const openai: AIProviderStatus = {
    configured: openaiConfigured,
    provider: "openai",
    model: parseModel(openaiModel, AI_OPENAI_DEFAULT_MODEL, OPENAI_MODELS),
    keyMask: openaiConfigured ? maskKey(openaiKey) : "",
    source: openaiKeyEnc ? "db" : openaiConfigured ? "env" : "db",
  };

  const gemini: AIProviderStatus = {
    configured: geminiConfigured,
    provider: "gemini",
    model: parseModel(geminiModel, AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS),
    keyMask: geminiConfigured ? maskKey(geminiKey) : "",
    source: geminiKeyEnc ? "db" : geminiConfigured ? "env" : "db",
  };

  // Provider ativo: preferência explícita do admin; senão primeira configurada.
  let activeProvider: AIProviderName | "" = "";
  if (provider === "openai" && openaiConfigured) activeProvider = "openai";
  else if (provider === "gemini" && geminiConfigured) activeProvider = "gemini";
  else if (openaiConfigured) activeProvider = "openai";
  else if (geminiConfigured) activeProvider = "gemini";

  return {
    openai,
    gemini,
    activeProvider,
    aiConfigured: Boolean(activeProvider),
  };
}

// ------------------------------------------------------------
// Escrita — APENAS admin
// ------------------------------------------------------------

export interface SaveAIProviderInput {
  provider: AIProviderName;
  /** Nova chave. Se vazio, mantém a existente (não sobrescreve). */
  apiKey?: string;
  model: AIModelChoice;
}

export async function saveAIProvider(input: SaveAIProviderInput): Promise<void> {
  const { provider, apiKey, model } = input;

  // Valida o model contra a lista oficial.
  const allowed = provider === "openai" ? OPENAI_MODELS : GEMINI_MODELS;
  const normalized = parseModel(
    model,
    provider === "openai" ? AI_OPENAI_DEFAULT_MODEL : AI_GEMINI_DEFAULT_MODEL,
    allowed
  );

  if (provider === "openai") {
    if (apiKey && apiKey.trim()) {
      await setSetting(AI_OPENAI_KEY, encryptToken(apiKey.trim()));
    }
    await setSetting(AI_OPENAI_MODEL, normalized);
    // Se era o provider ativo e há chave gravada, garante que continua.
    if (input.apiKey?.trim() || (await getSetting(AI_OPENAI_KEY))) {
      await setSetting(AI_PROVIDER_KEY, "openai");
    }
  } else {
    if (apiKey && apiKey.trim()) {
      await setSetting(AI_GEMINI_KEY, encryptToken(apiKey.trim()));
    }
    await setSetting(AI_GEMINI_MODEL, normalized);
    if (input.apiKey?.trim() || (await getSetting(AI_GEMINI_KEY))) {
      await setSetting(AI_PROVIDER_KEY, "gemini");
    }
  }

  // A configuração mudou → o runtime precisa reler (ver `@/lib/ai/runtime`).
  invalidateRuntimeAICache();
}

export async function removeAIProvider(provider: AIProviderName): Promise<void> {
  if (provider === "openai") {
    await removeSetting(AI_OPENAI_KEY);
    await removeSetting(AI_OPENAI_MODEL);
  } else {
    await removeSetting(AI_GEMINI_KEY);
    await removeSetting(AI_GEMINI_MODEL);
  }
  invalidateRuntimeAICache();
}

/** Testa uma chave fazendo uma chamada mínima de baixo custo. */
export async function testAIProvider(input: {
  provider: AIProviderName;
  apiKey?: string;
  model: AIModelChoice;
}): Promise<{ ok: boolean; message: string }> {
  const { provider, apiKey, model } = input;

  let key: string;
  if (apiKey && apiKey.trim()) {
    key = apiKey.trim();
  } else {
    const enc = await getSetting(provider === "openai" ? AI_OPENAI_KEY : AI_GEMINI_KEY);
    key = enc
      ? decryptToken(enc)
      : provider === "openai"
        ? process.env.OPENAI_API_KEY ?? ""
        : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  }
  if (!key) return { ok: false, message: "Nenhuma chave configurada para testar." };

  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        return { ok: false, message: `OpenAI retornou ${res.status}. Verifique a chave.` };
      }
      return { ok: true, message: "Conexão com OpenAI OK." };
    }

    // Gemini: chamada mínima de geração (baixo custo).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "responda apenas: ok" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `Gemini retornou ${res.status}. Verifique a chave.` };
    }
    return { ok: true, message: "Conexão com Gemini OK." };
  } catch {
    return { ok: false, message: "Não foi possível alcançar o provider. Verifique a rede." };
  }
}

// ------------------------------------------------------------
// Runtime — ponte para o provider do app
// ------------------------------------------------------------

/**
 * O runtime da IA é resolvido em `@/lib/ai/runtime.ts` — FONTE ÚNICA usada por
 * todas as ferramentas (IA Acessor, Gerador de Copy, Ideias) e também pelo
 * painel admin. Re-exportado aqui para não quebrar quem já importava daqui.
 *
 * Não reimplemente esta função: uma segunda cópia foi exatamente o que causou
 * a divergência em que o /admin/ia mostrava "ativa" e as ferramentas do cliente
 * diziam "IA ainda não configurada".
 */
export { resolveRuntimeAI } from "@/lib/ai/runtime";
export type { RuntimeAIConfig } from "@/lib/ai/runtime";
