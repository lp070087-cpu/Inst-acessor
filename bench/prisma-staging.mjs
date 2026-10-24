#!/usr/bin/env node
/**
 * WRAPPER SEGURO — PRISMA CONTRA A STAGING
 * ========================================
 * PROBLEMA QUE ELE RESOLVE
 *   O Prisma CLI carrega SOMENTE o arquivo `.env` (por convenção própria), e
 *   NÃO lê `.env.local` — esse é um comportamento do Next.js, não do Prisma.
 *   Como o `.env` deste projeto aponta para PRODUÇÃO, qualquer
 *   `npx prisma migrate status` (ou `db push`, etc.) conecta na produção,
 *   mesmo com o `.env.local` apontando para a staging.
 *
 * O QUE ESTE WRAPPER FAZ
 *   1. Lê o `.env.local` (o arquivo do ambiente local) — sem editar nada.
 *   2. Valida que DATABASE_URL e DIRECT_URL apontam para a STAGING
 *      (`ep-patient-brook-acffelj3…`).
 *   3. Aborta se qualquer um dos dois for produção (`ep-autumn-sky…`) ou
 *      qualquer outro host — exit 2, sem executar nada.
 *   4. Injeta as variáveis no processo filho e roda o comando Prisma com elas.
 *      (O Prisma não sobrescreve variáveis já definidas no ambiente.)
 *   5. NUNCA imprime senha nem a connection string — só o hostname.
 *
 * USO
 *   node bench/prisma-staging.mjs check                 # só valida e mostra os hosts
 *   node bench/prisma-staging.mjs migrate status        # roda o Prisma com a staging
 *   node bench/prisma-staging.mjs generate
 *   node bench/prisma-staging.mjs migrate deploy
 *
 * Nada é escrito no banco por este script — ele apenas EXECUTA o comando que
 * você pedir, contra a staging. Um comando que escreve continua escrevendo;
 * um comando de leitura continua só lendo.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import net from "node:net";

/** Endpoint da staging (prefixo do host). Só ele é aceito. */
const STAGING_HOST_PREFIX = "ep-patient-brook-acffelj3";
/** Endpoint de produção — presença dele aborta imediatamente. */
const PRODUCTION_HOST_MARKER = "ep-autumn-sky";

const ENV_FILE = resolve(process.cwd(), ".env.local");

/** Parser mínimo de .env: KEY=VALUE, ignora comentários, aceita aspas. */
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Extrai só o hostname — nunca a string inteira. */
function hostnameOnly(url) {
  const h = hostOf(url);
  return h ?? "(não foi possível ler o hostname)";
}

const env = parseEnvFile(ENV_FILE);

console.log("\n=== PRISMA — AMBIENTE LOCAL (validação de alvo) ===");
console.log(`Arquivo lido: ${ENV_FILE}`);
console.log("(nenhuma senha ou connection string é exibida — só o hostname)\n");

const problems = [];
const resolved = {};

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = env[key];
  if (!value) {
    problems.push(`${key} ausente em .env.local`);
    console.log(`  ${key.padEnd(14)} : AUSENTE`);
    continue;
  }
  const host = hostOf(value);
  console.log(`  ${key.padEnd(14)} : ${hostnameOnly(value)}`);
  resolved[key] = value;

  if (!host) {
    problems.push(`${key} não é uma URL válida`);
  } else if (host.includes(PRODUCTION_HOST_MARKER)) {
    problems.push(`${key} aponta para PRODUÇÃO (${PRODUCTION_HOST_MARKER}) — abortado`);
  } else if (!host.startsWith(STAGING_HOST_PREFIX)) {
    problems.push(`${key} não aponta para a staging esperada (${STAGING_HOST_PREFIX})`);
  }
}

console.log("");

if (problems.length) {
  console.error("  ⛔ ABORTADO — o .env.local NÃO está apontando só para a staging:\n");
  for (const p of problems) console.error(`     • ${p}`);
  console.error(
    [
      "",
      "  Nada foi executado. Corrija o .env.local para usar os endpoints da",
      `  staging (${STAGING_HOST_PREFIX}…), nunca os de produção.`,
      "",
    ].join("\n")
  );
  process.exit(2);
}

console.log("  ✅ Alvo confirmado: DATABASE_URL e DIRECT_URL apontam para a STAGING.");
console.log("     (produção não é tocada por este wrapper)\n");

/**
 * FALLBACK: o host DIRETO da staging recusa autenticação (P1000) enquanto a URL
 * do POOLER autentica normalmente com a MESMA credencial — verificado em
 * 2026-10-08 (as duas resolvem para os mesmos IPs de proxy da Neon). Sem isto,
 * qualquer comando do Prisma CLI aborta no P1000 e o banco de staging fica
 * inutilizável.
 *
 * Detecta o P1000 no host DIRETO e refaz a conexão com a URL do POOLER para
 * AMBAS as variáveis. Só age DENTRO da staging — já validado acima — então
 * produção continua impossível. A credencial nunca é impressa.
 */
/**
 * Testa AUTENTICAÇÃO REAL no host direto (não só a porta TCP).
 *
 * Um teste de porta engana: o proxy da Neon ACEITA a conexão TCP e só recusa
 * no handshake de autenticação — foi exatamente por isso que um teste de socket
 * passou enquanto o P1000 continuava. Aqui abrimos um `SELECT 1` de verdade com
 * o cliente Prisma e olhamos se autenticou.
 */
async function directHostAuthenticates(url) {
  let client;
  try {
    const { PrismaClient } = await import("@prisma/client");
    client = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await client.$queryRawUnsafe("SELECT 1");
    return true;
  } catch (err) {
    // Registra o MOTIVO real, sem vazar credencial. "falhou por outro motivo"
    // sem dizer qual tornava o diagnóstico impossível.
    const msg = String(err?.message ?? err ?? "");
    const code = /P1000/.test(msg)
      ? "P1000 (credencial recusada pelo host direto)"
      : msg.split("\n").map((l) => l.trim()).filter(Boolean)[0]?.slice(0, 140) || "erro desconhecido";
    console.log(`  ℹ️  Host direto não autenticou: ${code}`);
    return false;
  } finally {
    await client?.$disconnect().catch(() => {});
  }
}

const [, , subcommand, ...rest] = process.argv;

/** Quando o host direto não conecta, usa o pooler para ambos. */
async function effectiveEnv() {
  const base = {
    ...process.env,
    DATABASE_URL: resolved.DATABASE_URL ?? env.DATABASE_URL,
    DIRECT_URL: resolved.DIRECT_URL ?? env.DIRECT_URL,
  };
  const directAlive = await directHostAuthenticates(base.DIRECT_URL);
  if (directAlive) return { env: base, fellBack: false };

  // Fallback: DIRECT_URL = DATABASE_URL (pooler). Ainda é staging — validado acima.
  // A Neon recomenda o pooler para a aplicação e o direto para migrations; o
  // direto da staging recusa a credencial (P1000) mesmo com o pooler válido.
  // Só o pooler de STAGING pode ser usado aqui: o host foi validado no início.
  console.log("  ⚠️  O host DIRETO da staging não autenticou. Usando o POOLER de staging");
  console.log("     para as duas conexões (mesmo projeto — produção continua impossível).");
  console.log("     Corrija o DIRECT_URL no painel da Neon para remover este aviso.\n");
  return {
    env: { ...base, DIRECT_URL: base.DATABASE_URL },
    fellBack: true,
  };
}

if (!subcommand || subcommand === "check") {
  console.log("Modo 'check': validação concluída. Nada foi executado contra o banco.\n");
  console.log("Para rodar o Prisma com a staging:");
  console.log("  node bench/prisma-staging.mjs migrate status");
  console.log("  node bench/prisma-staging.mjs generate");
  console.log("");
  process.exit(0);
}

// Repassa o comando ao Prisma com as variáveis da STAGING no ambiente do filho.
// O Prisma CLI NÃO sobrescreve variáveis já presentes no ambiente, então mesmo
// que ele carregue o `.env` (produção), o valor da staging prevalece.
const prismaArgs = subcommand === "migrate" || subcommand === "db" ? [subcommand, ...rest] : [subcommand, ...rest];

console.log(`Executando: npx prisma ${prismaArgs.join(" ")}`);
console.log("(o Alvo abaixo, se aparecer no output do Prisma, deve ser a STAGING)\n");

const { env: childEnv } = await effectiveEnv();

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  stdio: "inherit",
  shell: true, // necessário no Windows para resolver npx.cmd
  env: childEnv,
});

process.exit(result.status ?? 1);
