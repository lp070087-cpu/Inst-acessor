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

/**
 * Modelos Gemini ACEITOS pela API v1beta `generateContent`.
 *
 * HISTÓRICO DO 404: a lista era `["gemini-1.5-flash", "gemini-1.5-pro"]`.
 * A Google aposentou a família 1.5 — a API responde HTTP 404 NOT_FOUND e o
 * painel admin mascarava isso como "verifique a chave".
 *
 * ⚠️ POR QUE O PADRÃO É UM MODELO 3.5 E NÃO UM 2.5:
 * a própria documentação da Google marca a família **2.5 como acesso
 * RESTRITO** — "limitada a quem já a usou ativamente no passado". Uma chave
 * NOVA pode receber 404 exatamente como acontecia com a 1.5, o que nos levaria
 * de volta ao bug que estamos corrigindo. A Google recomenda explicitamente
 * "3.5 Flash-Lite ou 3.8 Flash" para projetos novos. Por isso:
 *   • PADRÃO  = `gemini-3.5-flash-lite` (estável, o mais barato da linha 3.5)
 *   • os 2.5 seguem na LISTA (contas com histórico conseguem usá-los), mas
 *     nunca são escolhidos automaticamente.
 * A lista é fechada: um ID inválido nunca é enviado à API.
 */
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

export const AI_OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Valida um model contra a lista oficial do provider (fallback seguro). */
export function parseModel<T extends string>(
  value: string | undefined | null,
  fallback: T,
  allowed: readonly T[]
): T {
  if (value && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}
