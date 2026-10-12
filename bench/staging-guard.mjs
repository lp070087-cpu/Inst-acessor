/**
 * GUARDA DE STAGING — valida o alvo antes de qualquer operação no banco
 * =====================================================================
 * Compartilhado por `staging-inspect.mjs` (leitura) e `staging-cleanup.mjs`
 * (escrita). Objetivo único: NUNCA deixar uma operação rodar contra produção.
 *
 * Regras:
 *   • lê SOMENTE `.env.local` (nunca `.env`, que aponta para produção);
 *   • aceita SOMENTE hosts que começam com o endpoint da staging;
 *   • ABORTA (exit 2) se encontrar produção ou qualquer host desconhecido;
 *   • nunca imprime senha, connection string inteira, nem chave.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const STAGING_HOST_PREFIX = "ep-patient-brook-acffelj3";
export const PRODUCTION_HOST_MARKER = "ep-autumn-sky";

function parseEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Não consegui ler ${path}. Ele deve existir na raiz do projeto.`);
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Carrega `.env.local`, valida os dois hosts e devolve as URLs.
 * Lança (com mensagem clara) se qualquer coisa não for staging.
 */
export function loadStagingEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = parseEnvFile(envPath);

  const result = { envPath, hosts: {}, url: {}, directUrl: {} };
  const problems = [];

  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = env[key];
    if (!value) {
      problems.push(`${key} ausente em .env.local`);
      continue;
    }
    const host = hostOf(value);
    result.hosts[key] = host ?? "(host inválido)";
    if (!host) {
      problems.push(`${key} não é uma URL válida`);
    } else if (host.includes(PRODUCTION_HOST_MARKER)) {
      problems.push(`${key} aponta para PRODUÇÃO — abortado`);
    } else if (!host.startsWith(STAGING_HOST_PREFIX)) {
      problems.push(`${key} não aponta para a staging (${STAGING_HOST_PREFIX}…)`);
    }
    if (key === "DATABASE_URL") result.url = value;
    else result.directUrl = value;
  }

  if (problems.length) {
    const err = new Error(
      ["Alvo inválido no .env.local:", ...problems.map((p) => `  • ${p}`)].join("\n")
    );
    err.abort = true;
    throw err;
  }

  return result;
}

/** Imprime a validação sem revelar segredo (só hostnames). */
export function printTarget(result) {
  console.log("Alvo validado (.env.local) — somente staging:");
  console.log(`  DATABASE_URL : ${result.hosts.DATABASE_URL}`);
  console.log(`  DIRECT_URL   : ${result.hosts.DIRECT_URL}`);
  console.log("");
}
