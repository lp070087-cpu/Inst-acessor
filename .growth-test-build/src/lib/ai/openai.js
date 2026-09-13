"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
/**
 * Provider OpenAI (Chat Completions) — desacoplado.
 * Usa fetch nativo (Node 18+) — nenhuma dependência extra.
 * NUNCA exponha OPENAI_API_KEY no frontend.
 */
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
class OpenAIProvider {
    constructor(apiKey = process.env.OPENAI_API_KEY ?? "") {
        this.name = "openai";
        this.apiKey = apiKey;
    }
    async complete(opts) {
        const messages = opts.system
            ? [{ role: "system", content: opts.system }, ...opts.messages]
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
        const data = (await res.json());
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content)
            throw new Error("OpenAI retornou resposta vazia");
        return content;
    }
}
exports.OpenAIProvider = OpenAIProvider;
