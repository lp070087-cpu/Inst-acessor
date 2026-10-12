import type { AIProvider, AICompletionOptions } from "./provider";
import { AIProviderError } from "./provider";
import { AI_OPENAI_DEFAULT_MODEL } from "./settings-keys";
import { capMessages, capSystem, clampMaxTokens } from "./limits";

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
/**
 * TIMEOUT DA CHAMADA À IA.
 *
 * Sem `signal`, um `fetch` que não responde fica pendurado INDEFINIDAMENTE —
 * e a função serverless só termina quando o body resolve. Em pico isso esgota
 * o limite de concorrência e derruba o app inteiro (não só a geração). 30s é
 * generoso para uma resposta de texto; acima disso a chamada é abortada e o
 * erro sobe como qualquer outra falha do provedor (o chamador já trata com
 * `ok:false`). Mesmo padrão do cliente do Instagram (`AbortSignal.timeout`).
 */
const AI_TIMEOUT_MS = 30_000;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey = process.env.OPENAI_API_KEY ?? "", model = AI_OPENAI_DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(opts: AICompletionOptions): Promise<string> {
    // TETOS DEFENSIVOS: trunca system e mensagens antes de montar o request.
    // Um prompt gigante (histórico longo/legenda enorme) multiplicaria o custo
    // por token sem limite. A ordem das mensagens é preservada.
    const system = capSystem(opts.system);
    const capped = capMessages(opts.messages);
    const messages = system
      ? [{ role: "system" as const, content: system }, ...capped]
      : capped;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: clampMaxTokens(opts.maxTokens),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // A mensagem de erro da API nunca contém a chave; o texto é truncado
      // e a chave jamais é interpolada aqui.
      // 429 (rate limit) é tratado DISTINTAMENTE: mensagem clara e SEM retry —
      // insistir piora o bloqueio e multiplica custo.
      if (res.status === 429) {
        throw new AIProviderError(
          "rate_limit",
          "O provedor de IA limitou as requisições no momento. Aguarde alguns instantes e tente novamente.",
          429
        );
      }
      throw new AIProviderError(
        "http",
        `OpenAI API error ${res.status}: ${text.slice(0, 200)}`,
        res.status
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new AIProviderError("empty", "OpenAI retornou resposta vazia");
    return content;
  }
}
