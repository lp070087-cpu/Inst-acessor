/**
 * RUNNER DO TESTE — INTEGRAÇÃO INSTAGRAM
 * =======================================
 * Por que este arquivo existe (duas razões):
 *
 * 1) ALIAS `@/*`
 *    O compilador TypeScript NÃO reescreve aliases de `paths` no JavaScript
 *    emitido. Como `src/lib/integrations/instagram/oauth.ts` faz
 *    `import { encryptToken } from "@/lib/crypto"`, o arquivo compilado fica com
 *    `require("@/lib/crypto")` — que o Node não resolve sozinho.
 *    As outras suítes do projeto não têm esse problema porque só importam
 *    módulos sem alias; a do Instagram precisa mesmo carregar o `oauth.ts`,
 *    que é justamente o fluxo validado aqui.
 *    Solução: um resolvedor mínimo para `@/*` apontando para a saída compilada.
 *
 * 2) DETERMINISMO
 *    `client.ts` lê `process.env.INSTAGRAM_GRAPH_VERSION` no momento do import.
 *    Se a máquina de quem roda o teste tiver variáveis da integração definidas,
 *    o resultado mudaria. Limpamos o conjunto ANTES de carregar os testes para
 *    que o resultado seja o mesmo em qualquer máquina (os cenários de ambiente
 *    continuam sendo exercitados explicitamente pelo helper `withEnv`).
 *
 * Uso: npm run instagram:test
 * Sem dependências externas — apenas módulos nativos.
 */

const Module = require("node:module");
const path = require("node:path");

/** Raiz da saída compilada do `tsconfig.instagram-test.json`. */
const BUILD_ROOT = path.join(__dirname, "..", ".instagram-test-build");

// ---- 1) Determinismo: ambiente limpo antes de carregar os testes ----
for (const key of [
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "INSTAGRAM_REDIRECT_URI",
  "INSTAGRAM_SCOPES",
  "INSTAGRAM_GRAPH_VERSION",
  "META_APP_ID",
  "META_APP_SECRET",
  "TOKEN_ENCRYPTION_KEY",
]) {
  delete process.env[key];
}

// ---- 2) Resolvedor do alias `@/*` → saída compilada ----
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(BUILD_ROOT, "src", request.slice(2));
  }
  return originalResolve.call(this, request, ...rest);
};

require(path.join(BUILD_ROOT, "scripts", "instagram-tests.js"));
