import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  AI_PROVIDER_KEY,
  AI_OPENAI_KEY,
  AI_OPENAI_MODEL,
  AI_GEMINI_KEY,
  AI_GEMINI_MODEL,
  AI_OPENAI_DEFAULT_MODEL,
  AI_GEMINI_DEFAULT_MODEL,
  OPENAI_MODELS,
  GEMINI_MODELS,
  parseModel,
} from "./settings-keys";

/**
 * RUNTIME DA IA — FONTE ÚNICA DE VERDADE
 * ======================================
 * Resolve QUAL provider e QUAL modelo devem ser usados, considerando:
 *
 *   1. a configuração CENTRAL gravada pelo ADMIN (model `SystemSetting`,
 *      chave cifrada com AES-256-GCM);
 *   2. o fallback por variáveis de ambiente (`OPENAI_API_KEY`, `GEMINI_API_KEY`
 *      ou `GOOGLE_API_KEY`).
 *
 * Por que existe: antes, a área do cliente (`src/lib/ai/provider.ts`) lia
 * SOMENTE variáveis de ambiente, enquanto `/admin/ia` lia o banco. Resultado:
 * com a chave gravada apenas pelo Admin, o painel mostrava "ativa" e as
 * ferramentas do cliente diziam "IA ainda não configurada". Este módulo acaba
 * com essa divergência: TODO mundo lê daqui.
 *
 * Segurança:
 * - Server-only. A chave NUNCA é devolvida ao frontend.
 * - A chave nunca é logada nem incluída em mensagens de erro.
 * - Cliente (usuário comum) NUNCA configura chave.
 *
 * Degradação segura: se o model `SystemSetting` ainda não existir no banco
 * (ex.: `prisma db push` pendente), a leitura falha de forma controlada e o
 * runtime cai no fallback de env — a IA por variável de ambiente continua
 * funcionando exatamente como antes.
 */

export type AIProviderName = "openai" | "gemini";

export interface RuntimeAIConfig {
  provider: AIProviderName;
  apiKey: string;
  model: string;
  /** De onde veio a configuração efetiva. */
  source: "db" | "env";
}

/** Cache curto (por instância do servidor) para não bater no banco a cada chamada. */
const CACHE_TTL_MS = 15_000;
let cache: { value: RuntimeAIConfig | null; at: number } | null = null;

/** Invalida o cache — chamar após o ADMIN salvar/remover uma chave. */
export function invalidateRuntimeAICache(): void {
  cache = null;
}

interface SystemSettingDelegate {
  findUnique(args: unknown): Promise<{ id: string; key: string; value: string } | null>;
  findMany(args?: unknown): Promise<{ id: string; key: string; value: string }[]>;
}

/**
 * Lê todos os SystemSetting da IA de uma vez.
 * Retorna `null` quando a tabela não existe (schema ainda não aplicado) —
 * o chamador então usa apenas env.
 */
async function readSettings(): Promise<Map<string, string> | null> {
  try {
    const delegate = (prisma as unknown as { systemSetting?: SystemSettingDelegate })
      .systemSetting;
    if (!delegate?.findMany) return null;

    const rows = await delegate.findMany({
      where: {
        key: {
          in: [
            AI_PROVIDER_KEY,
            AI_OPENAI_KEY,
            AI_OPENAI_MODEL,
            AI_GEMINI_KEY,
            AI_GEMINI_MODEL,
          ],
        },
      },
      select: { key: true, value: true },
    });

    const map = new Map<string, string>();
    for (const row of rows) map.set(row.key, row.value);
    return map;
  } catch {
    // Tabela ausente / banco indisponível → fallback de env, sem quebrar a app.
    return null;
  }
}

/** Descriptografa com tolerância: valor corrompido não derruba o runtime. */
function safeDecrypt(value: string | undefined): string {
  if (!value) return "";
  try {
    return decryptToken(value) ?? "";
  } catch {
    return "";
  }
}

function envKeyFor(provider: AIProviderName): string {
  if (provider === "openai") return (process.env.OPENAI_API_KEY ?? "").trim();
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

/**
 * Resolve a configuração efetiva da IA.
 * @returns `null` quando NÃO há IA disponível (nem banco nem env).
 */
export async function resolveRuntimeAI(): Promise<RuntimeAIConfig | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const settings = await readSettings();

  // Chave do banco (quando o ADMIN gravou) tem precedência sobre a env.
  const dbOpenai = safeDecrypt(settings?.get(AI_OPENAI_KEY));
  const dbGemini = safeDecrypt(settings?.get(AI_GEMINI_KEY));
  const envOpenai = envKeyFor("openai");
  const envGemini = envKeyFor("gemini");

  const openaiKey = dbOpenai || envOpenai;
  const geminiKey = dbGemini || envGemini;

  // Provider preferido gravado pelo ADMIN; senão, o primeiro disponível.
  const preferred = settings?.get(AI_PROVIDER_KEY) ?? "";
  let provider: AIProviderName | null = null;
  if (preferred === "openai" && openaiKey) provider = "openai";
  else if (preferred === "gemini" && geminiKey) provider = "gemini";
  else if (openaiKey) provider = "openai";
  else if (geminiKey) provider = "gemini";

  if (!provider) {
    cache = { value: null, at: Date.now() };
    return null;
  }

  const model =
    provider === "openai"
      ? parseModel(
          settings?.get(AI_OPENAI_MODEL),
          AI_OPENAI_DEFAULT_MODEL,
          OPENAI_MODELS
        )
      : parseModel(
          settings?.get(AI_GEMINI_MODEL),
          AI_GEMINI_DEFAULT_MODEL,
          GEMINI_MODELS
        );

  const value: RuntimeAIConfig = {
    provider,
    apiKey: provider === "openai" ? openaiKey : geminiKey,
    model,
    source:
      provider === "openai"
        ? dbOpenai
          ? "db"
          : "env"
        : dbGemini
          ? "db"
          : "env",
  };

  cache = { value, at: Date.now() };
  return value;
}

/** A IA está disponível? (banco OU env). */
export async function isAIConfigured(): Promise<boolean> {
  return (await resolveRuntimeAI()) !== null;
}
