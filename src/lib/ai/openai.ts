import type { AIProvider, AICompletionOptions } from "./provider";

/**
 * Provider OpenAI (Chat Completions) — desacoplado.
 * Usa fetch nativo (Node 18+) — nenhuma dependência extra.
 * NUNCA exponha OPENAI_API_KEY no frontend.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;

  constructor(apiKey = process.env.OPENAI_API_KEY ?? "") {
    this.apiKey = apiKey;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const messages = opts.system
      ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
      : opts.messages;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1200,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI retornou resposta vazia");
    return content;
  }
}
