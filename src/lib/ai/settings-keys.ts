/**
 * CHAVES E MODELOS DA IA — constantes compartilhadas
 * ===================================================
 * Arquivo-folha (não importa nada) para evitar ciclo de importação entre
 * `src/lib/ai/runtime.ts` (que resolve o runtime) e
 * `src/lib/admin/ai-config.ts` (que grava a configuração).
 */

export const AI_PROVIDER_KEY = "ai.provider";
export const AI_OPENAI_KEY = "ai.openai.key";
export const AI_OPENAI_MODEL = "ai.openai.model";
export const AI_GEMINI_KEY = "ai.gemini.key";
export const AI_GEMINI_MODEL = "ai.gemini.model";

/** Modelos oficiais (escolha fechada — sem strings livres). */
export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
export const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"] as const;

export const AI_OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_GEMINI_DEFAULT_MODEL = "gemini-1.5-flash";

/** Valida um model contra a lista oficial do provider (fallback seguro). */
export function parseModel<T extends string>(
  value: string | undefined | null,
  fallback: T,
  allowed: readonly T[]
): T {
  if (value && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}
