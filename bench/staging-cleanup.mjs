#!/usr/bin/env node
/**
 * LIMPEZA CIRÚRGICA — STAGING (créditos cifrados com a chave antiga)
 * ==================================================================
 * Remove SOMENTE:
 *   1. SocialConnection.tokenEncrypted  → SET NULL (mantém a linha/conexão)
 *   2. SystemSetting: ai.openai.key e ai.gemini.key → DELETE (só essas duas)
 *
 * NÃO toca em: usuários, perfis, conteúdo, calendário, Rank, XP, métricas,
 * snapshots, publicações, biblioteca, planos, assinaturas, grants — nada mais.
 *
 * SEGURANÇA
 *   • usa SOMENTE `.env.local`;
 *   • exige host da staging (ep-patient-brook-acffelj3…) nos DOIS endpoints;
 *   • ABORTA se detectar produção (ep-autumn-sky…) ou qualquer outro host;
 *   • por padrão roda em DRY-RUN: mostra o que faria e NÃO escreve.
 *     A escrita só acontece com a flag explícita `--execute`.
 *   • nunca imprime senha, connection string, token ou chave.
 *
 * Uso:
 *   node bench/staging-cleanup.mjs            # dry-run (não escreve)
 *   node bench/staging-cleanup.mjs --execute  # executa a limpeza
 */

import { loadStagingEnv, printTarget } from "./staging-guard.mjs";

const EXECUTE = process.argv.includes("--execute");

let staging;
try {
  staging = loadStagingEnv();
} catch (err) {
  console.error("\n  ⛔ ABORTADO — alvo não é a staging.\n");
  console.error(String(err.message || err));
  console.error("\n  Nenhuma escrita foi feita.\n");
  process.exit(2);
}

printTarget(staging);
console.log(`Modo: ${EXECUTE ? "EXECUÇÃO REAL (--execute)" : "DRY-RUN (nada será escrito)"}\n`);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: staging.url } } });

const AI_KEYS = ["ai.openai.key", "ai.gemini.key"];

try {
  // Reconta dentro do mesmo contexto para relatar exatamente o que muda.
  const comToken = await prisma.socialConnection.count({
    where: { tokenEncrypted: { not: null } },
  });
  const aiCount = await prisma.systemSetting.count({ where: { key: { in: AI_KEYS } } });

  console.log("Alterações previstas:");
  console.log(`  • SocialConnection.tokenEncrypted = NULL  → ${comToken} linha(s)`);
  console.log(`  • SystemSetting DELETE (ai.*.key)         → ${aiCount} linha(s)\n`);

  if (!EXECUTE) {
    console.log("DRY-RUN: nada foi escrito. Para executar de verdade, use --execute.\n");
  } else {
    const upd = await prisma.socialConnection.updateMany({
      where: { tokenEncrypted: { not: null } },
      data: { tokenEncrypted: null },
    });
    const del = await prisma.systemSetting.deleteMany({ where: { key: { in: AI_KEYS } } });
    console.log("Concluído:");
    console.log(`  • linhas de SocialConnection atualizadas: ${upd.count}`);
    console.log(`  • linhas de SystemSetting removidas......: ${del.count}\n`);
    console.log("Conexões Instagram/TikTok e chave de IA precisam ser reconfiguradas.\n");
  }
} catch (err) {
  console.error("\n  Erro (verifique se algo foi parcialmente aplicado):", err?.message || err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
