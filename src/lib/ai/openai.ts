import type { AIProvider, AICompletionOptions } from "./provider";
import {
  aiFetchWithTimeout,
  throwAIHTTPError,
  AIProviderError,
} from "./provider";

/**
 * Provider OpenAI (Chat Completions) — desacoplado.
 * Usa fetch nativo (Node 18+) — nenhuma dependência extra.
 * NUNCA exponha OPENAI_API_KEY no frontend.
 *
 * O modelo vem da configuração central (admin/DB) quando disponível;
 * o padrão oficial é `gpt-4o-mini`. Timeout e erros HTTP são tratados na
 * camada única (`provider.ts`) — chave nunca aparece em mensagens/logs.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey =
      apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model || OPENAI_DEFAULT_MODEL;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const messages = opts.system
      ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
      : opts.messages;

    const res = await aiFetchWithTimeout(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1200,
      }),
    });

    if (!res.ok) {
      // Quota/429: tenta detectar "insufficient_quota" no corpo (sem logar chave).
      if (res.status === 429) {
        const text = await res.text().catch(() => "");
        if (/insufficient_quota|quota|billing/i.test(text)) {
          throw new AIProviderError(
            "quota",
            "Cota de IA esgotada ou cobrança pendente no provider. Verifique o plano.",
            429
          );
        }
      }
      throwAIHTTPError("OpenAI", res.status);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI retornou resposta vazia");
    return content;
  }
}
