import type { AIProvider, AICompletionOptions } from "./provider";
import {
  aiFetchWithTimeout,
  throwAIHTTPError,
  AIProviderError,
} from "./provider";

/**
 * Provider Google Gemini — desacoplado.
 * Usa fetch nativo — nenhuma dependência extra.
 * Suporta GEMINI_API_KEY ou GOOGLE_API_KEY (alias).
 *
 * O modelo vem da configuração central (admin/DB) quando disponível;
 * o padrão oficial é `gemini-1.5-flash`. Timeout e erros HTTP são tratados
 * na camada única (`provider.ts`) — chave nunca aparece em mensagens/logs.
 */

const GEMINI_URL = (key: string, model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

export const GEMINI_DEFAULT_MODEL = "gemini-1.5-flash";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey =
      apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    this.model = model || GEMINI_DEFAULT_MODEL;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    const system = opts.system
      ? [{ role: "user" as const, parts: [{ text: opts.system }] }]
      : [];

    const parts = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await aiFetchWithTimeout(GEMINI_URL(this.apiKey, this.model), {
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
      // Gemini usa 429 para rate limit e também para cota; inspeciona o corpo.
      if (res.status === 429) {
        const text = await res.text().catch(() => "");
        if (/quota|insufficient|billing|dailyLimit/i.test(text)) {
          throw new AIProviderError(
            "quota",
            "Cota do Gemini esgotada ou limite diário atingido. Verifique o plano.",
            429
          );
        }
      }
      throwAIHTTPError("Gemini", res.status);
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
