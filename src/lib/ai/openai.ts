import type { AIProvider, AICompletionOptions } from "./provider";
import { AI_OPENAI_DEFAULT_MODEL } from "./settings-keys";

/**
 * Provider OpenAI (Chat Completions) — desacoplado.
 * Usa fetch nativo (Node 18+) — nenhuma dependência extra.
 *
 * A chave é INJETADA pelo runtime (`src/lib/ai/index.ts`), que a resolve da
 * configuração central do Admin (SystemSetting cifrado) com fallback para
 * `OPENAI_API_KEY`. NUNCA exponha a chave no frontend.
 *
 * O construtor sem argumento ainda mantém o comportamento antigo (env) para
 * testes e para chamadas diretas — mas o caminho normal do app passa o
 * `apiKey` e o `model` resolvidos.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey = process.env.OPENAI_API_KEY ?? "", model = AI_OPENAI_DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const messages = opts.system
      ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
      : opts.messages;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      const text = await res.text().catch(() => "");
      // A mensagem de erro da API nunca contém a chave; o texto é truncado
      // e a chave jamais é interpolada aqui.
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
