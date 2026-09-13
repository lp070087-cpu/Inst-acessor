import type { AIProvider, AICompletionOptions } from "./provider";
import { AI_GEMINI_DEFAULT_MODEL } from "./settings-keys";

/**
 * Provider Google Gemini — desacoplado.
 * Usa fetch nativo — nenhuma dependência extra.
 *
 * A chave é INJETADA pelo runtime (`src/lib/ai/index.ts`), que a resolve da
 * configuração central do Admin (SystemSetting cifrado) com fallback para
 * `GEMINI_API_KEY` ou `GOOGLE_API_KEY`.
 *
 * O construtor sem argumento mantém o comportamento antigo (env) para testes
 * e chamadas diretas. O modelo agora é parametrizável (antes era fixo em
 * `gemini-1.5-flash`, ignorando a escolha salva no Admin).
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(
    apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    model = AI_GEMINI_DEFAULT_MODEL
  ) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const system = opts.system
      ? [{ role: "user" as const, parts: [{ text: opts.system }] }]
      : [];

    const parts = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [...system, ...parts],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 1200,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Nunca interpolar a chave: ela vive na query string, não na mensagem.
      throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!content) throw new Error("Gemini retornou resposta vazia");
    return content;
  }
}
