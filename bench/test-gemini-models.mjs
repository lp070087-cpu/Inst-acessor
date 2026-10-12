#!/usr/bin/env node
/**
 * TESTE — MODELOS GEMINI (correção do erro 404)
 * =============================================
 * Verifica, sem rede e sem credencial, que:
 *   1. NENHUM modelo aposentado (família 1.5) está na allow-list;
 *   2. o default é um modelo válido da lista;
 *   3. `parseModel` (a função que trava o modelo do runtime) aceita só a lista
 *      e cai no default para qualquer coisa fora dela — que era o mecanismo
 *      pelo qual um `gemini-1.5-flash` salvo voltava a ser usado.
 *
 * Reimplementa as constantes/função como estão em
 * `src/lib/ai/settings-keys.ts` (sem build step de TS aqui). Se a lista do app
 * mudar, atualize aqui — é o custo de testar sem toolchain.
 *
 * Uso: node bench/test-gemini-models.mjs
 */

// --- cópia fiel de settings-keys.ts ---------------------------------------
const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"];
const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];
const AI_OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const AI_GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

function parseModel(value, fallback, allowed) {
  if (value && allowed.includes(value)) return value;
  return fallback;
}

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`);
  }
}

console.log("Allow-list Gemini");
check("não contém gemini-1.5-flash", !GEMINI_MODELS.includes("gemini-1.5-flash"));
check("não contém gemini-1.5-pro", !GEMINI_MODELS.includes("gemini-1.5-pro"));
check(
  "nenhum id 1.5 na lista",
  GEMINI_MODELS.every((m) => !m.includes("1.5"))
);
check("contém gemini-3.5-flash-lite", GEMINI_MODELS.includes("gemini-3.5-flash-lite"));
check("default está na lista", GEMINI_MODELS.includes(AI_GEMINI_DEFAULT_MODEL));
check("default é gemini-3.5-flash-lite", AI_GEMINI_DEFAULT_MODEL === "gemini-3.5-flash-lite");

console.log("Allow-list OpenAI (não deve ter sido afetada)");
check("default openai = gpt-4o-mini", AI_OPENAI_DEFAULT_MODEL === "gpt-4o-mini");
check("openai segue com 2 modelos", OPENAI_MODELS.length === 2);

console.log("parseModel — o ponto do 404");
check(
  "modelo aposentado salvo → cai no default novo",
  parseModel("gemini-1.5-flash", AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS) ===
    "gemini-3.5-flash-lite"
);
check(
  "modelo válido → é mantido",
  parseModel("gemini-2.5-pro", AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS) ===
    "gemini-2.5-pro"
);
check(
  "vazio → cai no default",
  parseModel("", AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS) === "gemini-3.5-flash-lite"
);
check(
  "lixo → cai no default (nunca envia id inválido)",
  parseModel("modelo-inventado", AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS) ===
    "gemini-3.5-flash-lite"
);
check(
  "modelo OpenAI não vaza para o Gemini",
  parseModel("gpt-4o", AI_GEMINI_DEFAULT_MODEL, GEMINI_MODELS) ===
    "gemini-3.5-flash-lite"
);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
