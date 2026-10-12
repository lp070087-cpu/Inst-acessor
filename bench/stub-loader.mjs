/**
 * LOADER DE TESTE — ALIAS + SHIM MÍNIMO DE `next/server`
 * ======================================================
 * Estende o loader de alias (`ts-alias-loader.mjs`) com UMA coisa a mais: um
 * shim OFFLINE do `next/server`, para que o teste possa importar a ROTA REAL
 * (`src/app/api/webhooks/asaas/route.ts`) e exercitar sua lógica de autenticação
 * (sem rede, sem Next, sem banco).
 *
 * O shim implementa apenas `NextResponse.json(body, init)` devolvendo
 * `{ _json, _status }` — o suficiente para o teste ler o status HTTP que a rota
 * respondeu. NADA de comportamento de framework é simulado além disso: só a
 * forma de resposta que a rota usa é reproduzida.
 *
 * Uso: node --import ./bench/register-ts-alias.mjs --import ./bench/stub-loader.mjs <teste>
 * (no teste, basta registrar este loader; o de alias já vem pelo --import).
 */
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const SRC = pathToFileURL(resolvePath(process.cwd(), "src") + "/").href;

const NEXT_SERVER_SHIM =
  "data:text/javascript," +
  encodeURIComponent(
    "export const NextResponse = { json: (body, init) => ({ _json: body, _status: (init && init.status) || 200 }) };\n" +
      "export const NextRequest = class {};"
  );

function withExtension(url) {
  if (/\.(ts|tsx|mjs|js|json)$/.test(url)) return url;
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = url + suffix;
    try {
      if (existsSync(new URL(candidate))) return candidate;
    } catch {
      /* ignora */
    }
  }
  return url;
}

export async function resolve(specifier, context, next) {
  if (specifier === "next/server") return next(NEXT_SERVER_SHIM, context);
  if (specifier.startsWith("@/")) {
    return next(withExtension(SRC + specifier.slice(2)), context);
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(ts|tsx|mjs|js|json)$/.test(specifier)
  ) {
    const parent = context.parentURL;
    if (parent) {
      return next(withExtension(new URL(specifier, parent).href), context);
    }
  }
  return next(specifier, context);
}
