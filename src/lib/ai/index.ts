/**
 * Barrel do provider IA — resolve o provider ativo.
 * Fonte: configuração admin (DB, encriptada) → fallback env vars.
 * Ordem de preferência: OpenAI → Gemini.
 */
import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export * from "./provider";
export * from "./openai";
export * from "./gemini";

/**
 * Retorna o provider ativo, ou `null` se nenhuma API key estiver configurada.
 *
 * Consulta primeiro a configuração central (admin, persistida encriptada no
 * banco); se nada estiver gravado, usa as env vars. Nunca é chamado no client.
 */
export async function getAIProvider(): Promise<AIProvider | null> {
  const { resolveRuntimeAI } = await import("@/lib/admin/ai-config");
  const resolved = await resolveRuntimeAI();

  if (resolved) {
    if (resolved.provider === "openai") {
      return new OpenAIProvider(resolved.apiKey);
    }
    return new GeminiProvider(resolved.apiKey);
  }

  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    return new GeminiProvider();
  return null;
}
