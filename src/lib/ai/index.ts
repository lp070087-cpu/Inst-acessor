/**
 * Barrel do provider IA — resolve o provider ativo pelas env vars.
 * Ordem: OpenAI → Gemini.
 */
import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export * from "./provider";
export * from "./openai";
export * from "./gemini";

/**
 * Retorna o provider ativo, ou `null` se nenhuma API key estiver configurada.
 * NUNCA deve ser chamado no client (server-only).
 */
export function getAIProvider(): AIProvider | null {
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    return new GeminiProvider();
  return null;
}
