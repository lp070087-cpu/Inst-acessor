/**
 * Barrel do provider IA.
 *
 * FONTE DE VERDADE: a configuração central do Admin (`SystemSetting` cifrado),
 * com fallback para as variáveis de ambiente. Toda a resolução vive em
 * `./runtime.ts` — este arquivo só a expõe com a API que o resto do app já usa.
 *
 * Antes, `getAIProvider()`/`aiConfigured()` liam SOMENTE env vars, enquanto
 * `/admin/ia` lia o banco. Isso fazia o painel mostrar "IA ativa" e as
 * ferramentas do cliente dizerem "IA ainda não configurada". Agora ambos leem
 * daqui.
 *
 * ⚠️ Server-only. NUNCA importe com chave no cliente.
 */
import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { resolveRuntimeAI, type RuntimeAIConfig } from "./runtime";

export * from "./provider";
export * from "./openai";
export * from "./gemini";
export * from "./runtime";
export * from "./settings-keys";

/** Cria o provider a partir de uma configuração já resolvida. */
export function createAIProvider(config: RuntimeAIConfig): AIProvider {
  return config.provider === "openai"
    ? new OpenAIProvider(config.apiKey, config.model)
    : new GeminiProvider(config.apiKey, config.model);
}

/**
 * Provider ativo (banco do Admin → env), ou `null` se não houver IA.
 * Resolve o modelo escolhido no Admin (antes o Gemini ignorava essa escolha).
 */
export async function getAIProvider(): Promise<AIProvider | null> {
  const config = await resolveRuntimeAI();
  return config ? createAIProvider(config) : null;
}

/** A IA está configurada? (banco do Admin OU env). */
export async function aiConfigured(): Promise<boolean> {
  return (await resolveRuntimeAI()) !== null;
}
