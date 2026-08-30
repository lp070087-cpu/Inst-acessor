/**
 * Camada genérica de provider de IA — desacoplada.
 * Suporta OpenAI e Gemini. Sem mock: se nenhuma API key estiver configurada,
 * `aiConfigured()` retorna false e a UI mostra "IA ainda não configurada".
 *
 * A configuração é CENTRAL (área admin, Fase 10): o DONO grava a chave via
 * `/api/admin/ia`, ela é persistida encriptada no banco (SystemSetting) e
 * passa a valer para o runtime. Se não houver chave no banco, cai para as
 * variáveis de ambiente (OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY).
 *
 * ⚠️ Estas funções rodam APENAS no servidor (route handlers / lib).
 * NUNCA importar este módulo em componentes client com API keys.
 * NUNCA expor chave no frontend.
 */

export type AIMessageInput = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface AICompletionOptions {
  messages: AIMessageInput[];
  /** Prompt de sistema complementar (contexto). */
  system?: string;
  /** Temperatura (0–2). Default por provider. */
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  /** Completa um chat com o provider (sem tool calls). */
  complete(opts: AICompletionOptions): Promise<string>;
}

/**
 * Estado global "IA configurada?" — consulta a configuração admin (DB) e,
 * como fallback, as env vars. Server-only.
 */
export async function aiConfigured(): Promise<boolean> {
  const { resolveRuntimeAI } = await import("@/lib/admin/ai-config");
  const resolved = await resolveRuntimeAI();
  if (resolved) return true;
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY
  );
}
