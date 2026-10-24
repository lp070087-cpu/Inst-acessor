#!/usr/bin/env node
/**
 * INSPEÇÃO READ-ONLY DA STAGING — créditos criptografados
 * ======================================================
 * Conta o que existe, SEM ler nenhum valor. Apenas `SELECT ... count(*)` e a
 * LISTAGEM de chaves de SystemSetting (nomes, não valores). NÃO faz UPDATE,
 * DELETE nem qualquer escrita.
 *
 * Uso (a partir da raiz do projeto):
 *   node bench/staging-inspect.mjs
 *
 * Requer o engine do Prisma para o SEU sistema operacional (você está no
 * Windows). Rode com o Node 22 do projeto.
 */

import { loadStagingEnv, printTarget } from "./staging-guard.mjs";

let staging;
try {
  staging = loadStagingEnv();
} catch (err) {
  console.error("\n  ⛔ ABORTADO — alvo não é a staging.\n");
  console.error(String(err.message || err));
  console.error("\n  Nenhuma consulta foi executada.\n");
  process.exit(2);
}

printTarget(staging);
console.log("Modo: INSPEÇÃO READ-ONLY (nenhuma escrita)\n");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: staging.url } } });

try {
  const totalConn = await prisma.socialConnection.count();
  const comToken = await prisma.socialConnection.count({
    where: { tokenEncrypted: { not: null } },
  });

  const aiKeys = await prisma.systemSetting.findMany({
    where: { key: { in: ["ai.openai.key", "ai.gemini.key"] } },
    select: { key: true },
  });

  // Detalhe das conexões que SERIAM alteradas — sem expor o token.
  const detalhe = await prisma.socialConnection.findMany({
    where: { tokenEncrypted: { not: null } },
    select: { id: true, platform: true, status: true },
  });

  console.log("A/B. SocialConnection");
  console.log(`   total de conexões..............: ${totalConn}`);
  console.log(`   com tokenEncrypted preenchido..: ${comToken}`);
  console.log("   registros que seriam limpos (id, platform, status):");
  if (detalhe.length === 0) console.log("     (nenhum)");
  for (const d of detalhe) {
    console.log(`     - ${d.id}  | ${d.platform} | ${d.status}`);
  }

  console.log("\nC. SystemSetting — chaves de IA cifradas");
  if (aiKeys.length === 0) {
    console.log("   nenhuma das chaves ai.openai.key / ai.gemini.key existe");
  } else {
    for (const k of aiKeys) console.log(`   existe: ${k.key}`);
  }

  console.log("\nD. Resumo do que seria alterado na limpeza:");
  console.log(`   UPDATE SocialConnection.tokenEncrypted = NULL  → ${comToken} linha(s)`);
  console.log(`   DELETE SystemSetting (ai.openai.key/ai.gemini.key) → ${aiKeys.length} linha(s)`);
  console.log("\n   Nada foi alterado. Aguardando autorização para a limpeza.\n");
} catch (err) {
  console.error("\n  Erro ao consultar (nada foi alterado):", err?.message || err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
