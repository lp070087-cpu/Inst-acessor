/**
 * LOADER DE ALIAS PARA OS TESTES PUROS
 * ====================================
 * Permite que um teste em `bench/` importe os módulos REAIS de `src/lib`,
 * resolvendo o alias `@/` e a extensão omitida (estilo TypeScript: `./x` em vez
 * de `./x.ts`). Sem isto, o Node não encontra `@/lib/...` nem arquivos sem
 * extensão, e o teste acabaria reimplementando a regra — que é exatamente o que
 * queremos evitar.
 *
 * Uso: node --import ./bench/register-ts-alias.mjs <teste.mjs>
 */
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const SRC = pathToFileURL(resolvePath(process.cwd(), "src") + "/").href;

/** Tenta o caminho como veio e, se faltar, com `.ts` / `.tsx` / `/index.ts`. */
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
  if (specifier === "next/server") return next("next/server.js", context);
  // Alias do projeto: @/ → src/
  if (specifier.startsWith("@/")) {
    return next(withExtension(SRC + specifier.slice(2)), context);
  }
  // Imports RELATIVOS sem extensão (estilo TypeScript: "./catalog"). O Node só
  // resolve com extensão, então completamos antes de entregar.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.(ts|tsx|mjs|js|json)$/.test(specifier)) {
    const parent = context.parentURL;
    if (parent) {
      const abs = new URL(specifier, parent).href;
      return next(withExtension(abs), context);
    }
  }
  return next(specifier, context);
}
