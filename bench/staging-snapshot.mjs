#!/usr/bin/env node
/**
 * SNAPSHOT READ-ONLY DA STAGING — prova de preservação de dados
 * ============================================================
 * Conta linhas das tabelas existentes ANTES e DEPOIS de aplicar migrations.
 * Só faz `count()`. Nunca escreve, nunca lê valores.
 *
 * Uso: node bench/staging-snapshot.mjs
 */
import { loadStagingEnv } from "./staging-guard.mjs";

let staging;
try { staging = loadStagingEnv(); }
catch (err) { console.error("⛔ ABORTADO — alvo não é staging.\n" + err.message); process.exit(2); }

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: staging.url } } });

const TABLES = [
  "user", "account", "session", "userProfile", "userPreferences",
  "socialConnection", "instagramProfile", "instagramSnapshot", "instagramMedia",
  "instagramMediaMetric", "instagramComment", "tikTokProfile", "tikTokSnapshot",
  "tikTokVideo", "aiConversation", "aiMessage", "aiProfile", "generatedCopy",
  "contentIdea", "socialDraft", "mentorshipRecommendation", "profileScore",
  "knowledgeVersion", "knowledgeModule", "knowledgeRule", "growthExperiment",
  "profileInsight", "userLevel", "xpLog", "achievement", "userAchievement",
  "publishQueue", "publishLog", "automationRule", "automationEvent",
  "automationExecution", "growthAction", "plan", "subscription", "payment",
  "billingEvent", "accessGrant", "firstAccessToken", "userGoal", "plannedContent",
  "systemSetting", "checkoutOrder", "commentAutomationRule", "replyTemplate",
  "specialProfileRule", "commentReplyLog", "mediaAsset",
];

const out = {};
for (const t of TABLES) {
  const model = t;
  try {
    out[t] = await prisma[model].count();
  } catch {
    out[t] = "n/a";
  }
}
console.log(JSON.stringify(out, null, 0));
await prisma.$disconnect();
