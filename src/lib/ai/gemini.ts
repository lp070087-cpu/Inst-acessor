import type { AIProvider, AICompletionOptions } from "./provider";
import { AIProviderError } from "./provider";
import { AI_GEMINI_DEFAULT_MODEL } from "./settings-keys";
import { capMessages, capSystem, clampMaxTokens } from "./limits";

/**
 * Provider Google Gemini — desacoplado.
 * Usa fetch nativo — nenhuma dependência extra.
 *
 * A chave é INJETADA pelo runtime (`src/lib/ai/index.ts`), que a resolve da
 * configuração central do Admin (SystemSetting cifrado) com fallback para
 * `GEMINI_API_KEY` ou `GOOGLE_API_KEY`.
 *
 * O construtor sem argumento mantém o comportamento antigo (env) para testes
 * e chamadas diretas. O modelo é parametrizável e o padrão vem de
 * `AI_GEMINI_DEFAULT_MODEL` (`@/lib/ai/settings-keys`), hoje `gemini-2.5-flash`
 * — a família 1.5 foi aposentada pela Google e respondia 404.
 */
/**
 * TIMEOUT DA CHAMADA À IA — mesmo racional do provider OpenAI: sem `signal`,
 * um `fetch` sem resposta prende a função serverless indefinidamente e, em
 * pico, esgota a concorrência. 30s aborta o caso patológico sem cortar uma
 * resposta legítima.
 */
const AI_TIMEOUT_MS = 30_000;

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
    if (!this.apiKey.trim()) throw new AIProviderError("http", "Gemini não configurado neste ambiente.");
    try {
    // TETOS DEFENSIVOS: mesmo racional do provider OpenAI — trunca system e
    // mensagens antes de montar o request, para o custo por token ter limite.
    const systemText = capSystem(opts.system);
    const system = systemText
      ? [{ role: "user" as const, parts: [{ text: systemText }] }]
      : [];

    const parts = capMessages(opts.messages, systemText).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;

    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        contents: [...system, ...parts],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: clampMaxTokens(opts.maxTokens),
        },
      }),
    });

    if (!res.ok) {
      // Never propagate provider bodies: they may contain reflected inputs.
      // 429 é tratado DISTINTAMENTE: mensagem clara e SEM retry — insistir
      // piora o bloqueio e multiplica custo.
      if (res.status === 429) {
        throw new AIProviderError(
          "rate_limit",
          "O provedor de IA limitou as requisições no momento. Aguarde alguns instantes e tente novamente.",
          429
        );
      }
      throw new AIProviderError(
        "http",
        `O Gemini recusou a solicitação (HTTP ${res.status}). Verifique a configuração e a disponibilidade do provedor.`,
        res.status
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!content) throw new AIProviderError("empty", "Gemini retornou resposta vazia");
    return content;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError("http", "Não foi possível concluir a solicitação ao Gemini. Tente novamente mais tarde.");
    }
  }
}
