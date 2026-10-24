/**
 * Camada genérica de provider de IA — desacoplada.
 *
 * Suporta OpenAI e Gemini. Sem mock: se não houver IA configurada,
 * `aiConfigured()` retorna false e a UI mostra "IA ainda não configurada".
 *
 * A resolução de "qual provider / qual chave / qual modelo" vive em
 * `./runtime.ts`, que lê a configuração CENTRAL do Admin (SystemSetting
 * cifrado) com fallback para env. Este arquivo define apenas o CONTRATO do
 * provider — as funções concretas estão em `./index.ts`.
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
 * Erro tipado do provider de IA.
 *
 * `code` distingue os casos que exigem AÇÃO diferente do chamador:
 *   • `rate_limit` → HTTP 429 do provedor. NÃO se deve re-tentar em laço
 *     (insistir piora o bloqueio e multiplica custo). A mensagem é clara e o
 *     chamador decide esperar/tentar mais tarde.
 *   • `empty`      → o provedor respondeu 200 mas sem conteúdo utilizável.
 *   • `http`       → qualquer outro status não-ok.
 *
 * A mensagem não deve incluir a chave nem corpos de erro do provedor.
 */
export class AIProviderError extends Error {
  code: "rate_limit" | "empty" | "http";
  status?: number;
  constructor(code: AIProviderError["code"], message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}

/**
 * NOTA: `aiConfigured()` e `getAIProvider()` saíram daqui.
 *
 * Elas agora vivem em `./index.ts` e são ASSÍNCRONAS, porque a configuração
 * central do Admin está no banco (SystemSetting). Importe-as de `@/lib/ai`:
 *
 *   import { aiConfigured, getAIProvider } from "@/lib/ai";
 *   const configured = await aiConfigured();
 */
