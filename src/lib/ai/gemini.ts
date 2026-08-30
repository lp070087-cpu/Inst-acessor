import type { AIProvider, AICompletionOptions } from "./provider";

/**
 * Provider Google Gemini — desacoplado.
 * Usa fetch nativo — nenhuma dependência extra.
 * Suporta GEMINI_API_KEY ou GOOGLE_API_KEY (alias).
 */

const GEMINI_URL = (key: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey =
      apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    this.model = model || "gemini-1.5-flash";
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const system = opts.system
      ? [{ role: "user" as const, parts: [{ text: opts.system }] }]
      : [];

    const parts = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(GEMINI_URL(this.apiKey, this.model), {
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
