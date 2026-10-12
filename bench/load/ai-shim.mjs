/**
 * SHIM DE IA — MOCK DE PROCESSO (zero alteração no código do app)
 * ================================================================
 * O laboratório precisa medir o caminho da geração de IA SEM chamar o provedor
 * real (custo + proibido pela regra desta rodada). As URLs da OpenAI e do
 * Gemini são fixas no código dos providers, então em vez de editar esses
 * arquivos, este shim intercepta o `fetch` GLOBAL do processo Node e devolve
 * uma resposta fabricada quando o destino é um host de IA. Qualquer outro
 * destino passa direto, sem tocar.

 * COMO USAR (o shim é carregado ANTES do servidor Next):
 *
 *   node --import ./bench/load/ai-shim.mjs node_modules/next/dist/bin/next dev
 *
 * Assim TODO `fetch` feito pelo servidor (incluindo os providers de IA) passa
 * por aqui. Nenhum arquivo de `src/` é modificado; desligar é só não carregar o
 * shim. Cada chamada interceptada é registrada no stderr para PROVA de que
 * nenhuma requisição real saiu.
 */

const AI_HOSTS = new Set([
  "api.openai.com",
  "generativelanguage.googleapis.com",
]);

const originalFetch = globalThis.fetch;

function mockBodyFor(host) {
  if (host === "api.openai.com") {
    return { choices: [{ message: { content: "[mock-ia] resposta simulada do laboratório." } }] };
  }
  // Gemini
  return { candidates: [{ content: { parts: [{ text: "[mock-ia] resposta simulada do laboratório." }] } }] };
}

globalThis.fetch = async function shimmedFetch(input, init) {
  let url;
  try {
    url = typeof input === "string" ? input : input?.url;
  } catch {
    url = null;
  }

  let host = null;
  try {
    host = url ? new URL(url).hostname.toLowerCase() : null;
  } catch {
    host = null;
  }

  if (host && AI_HOSTS.has(host)) {
    process.stderr.write(`[ai-shim] INTERCEPTADO (nenhuma chamada real): ${host}\n`);
    return new Response(JSON.stringify(mockBodyFor(host)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return originalFetch(input, init);
};

process.stderr.write("[ai-shim] ativo — chamadas a OpenAI/Gemini serão respondidas localmente.\n");
