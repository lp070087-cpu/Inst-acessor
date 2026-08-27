/**
 * Camada genérica de provider de IA — desacoplada.
 * Suporta OpenAI e Gemini via env. Sem mock:
 * se nenhuma API key estiver configurada, `aiConfigured()` retorna false
 * e a UI mostra "IA ainda não configurada".
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

/** Estado global "IA configurada?" — derivado apenas das env vars. */
export function aiConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY
  );
}
