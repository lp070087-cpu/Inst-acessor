#!/usr/bin/env node
/**
 * TESTE — FRANQUIAS POR PLANO (núcleo puro + janelas)
 * ===================================================
 * Prova, sem banco:
 *   • o usuário precisa respeitar o limite DIÁRIO **e** o do CICLO (o mais
 *     restritivo vence);
 *   • em MODO MEDIÇÃO nada é bloqueado (ativação comercial pendente);
 *   • ligando o enforcement, o bloqueio funciona e diz qual janela estourou;
 *   • a virada do dia usa o horário de BRASÍLIA, não UTC (um instante às 23h de
 *     Brasília ainda é o MESMO dia; às 01h já é o dia seguinte);
 *   • o plano Semanal não tem franquia (preserva o comportamento atual).
 *
 * Importa o MÓDULO REAL via Node (type-stripping) — não reimplementa a regra.
 *
 * Uso: node bench/test-quotas.mjs
 */
import "./db-guard.mjs"; // trava: nunca tocar produção
import { PLAN_QUOTAS, quotaForPlan, evaluateQuota, limitFor, LIMITS_ENFORCEMENT_ENABLED } from "../src/lib/billing/plans/limits.ts";
import { saoPauloDayKey } from "../src/lib/billing/usage/periods.ts";

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n}`)); };

console.log("Franquias propostas por plano");
check("start: 10/dia e 100/ciclo",
  PLAN_QUOTAS.start.aiPerDay === 10 && PLAN_QUOTAS.start.aiPerCycle === 100);
check("essencial: 25/dia e 300/ciclo",
  PLAN_QUOTAS.essencial.aiPerDay === 25 && PLAN_QUOTAS.essencial.aiPerCycle === 300);
check("pro: 50/dia e 700/ciclo",
  PLAN_QUOTAS.pro.aiPerDay === 50 && PLAN_QUOTAS.pro.aiPerCycle === 700);
check("elite: 100/dia e 1500/ciclo",
  PLAN_QUOTAS.elite.aiPerDay === 100 && PLAN_QUOTAS.elite.aiPerCycle === 1500);
check("master: 200/dia e 3000/ciclo",
  PLAN_QUOTAS.master.aiPerDay === 200 && PLAN_QUOTAS.master.aiPerCycle === 3000);

console.log("Semanal preserva o comportamento atual (sem franquia)");
check("semanal: sem teto de IA", quotaForPlan("semanal").aiPerDay === null && quotaForPlan("semanal").aiPerCycle === null);
check("plano desconhecido cai no semanal", quotaForPlan("inexistente").aiPerDay === null);
check("plano nulo cai no semanal", quotaForPlan(null).aiPerCycle === null);
check("mensal (legado) sem teto — contrato vigente", quotaForPlan("mensal").aiPerCycle === null);

console.log("Modo MEDIÇÃO (ativação comercial pendente)");
check("enforcement desligado por padrão", LIMITS_ENFORCEMENT_ENABLED === false);
const measuring = evaluateQuota({
  quota: PLAN_QUOTAS.start, feature: "ai_generation",
  usedToday: 9999, usedThisCycle: 9999, enforcementEnabled: false,
});
check("não bloqueia mesmo muito acima do limite", measuring.allowed === true);
check("nem reporta motivo", measuring.reason === null);

console.log("Bloqueio (enforcement ligado) — o mais restritivo vence");
const dailyHit = evaluateQuota({
  quota: PLAN_QUOTAS.start, feature: "ai_generation",
  usedToday: 10, usedThisCycle: 10, enforcementEnabled: true,
});
check("limite DIÁRIO estourado bloqueia", dailyHit.allowed === false && dailyHit.reason === "daily_limit");

const cycleHit = evaluateQuota({
  quota: PLAN_QUOTAS.start, feature: "ai_generation",
  usedToday: 3, usedThisCycle: 100, enforcementEnabled: true,
});
check("limite do CICLO estourado bloqueia", cycleHit.allowed === false && cycleHit.reason === "cycle_limit");

const ok = evaluateQuota({
  quota: PLAN_QUOTAS.start, feature: "ai_generation",
  usedToday: 9, usedThisCycle: 99, enforcementEnabled: true,
});
check("dentro das duas janelas → libera", ok.allowed === true);
check("reporta o saldo", ok.remaining === 1);

console.log("Limite por capacidade");
check("auto_reply usa o limite de CICLO",
  limitFor(PLAN_QUOTAS.pro, "auto_reply", "cycle") === 800 &&
  limitFor(PLAN_QUOTAS.pro, "auto_reply", "day") === null);
check("publicação usa o limite de CICLO",
  limitFor(PLAN_QUOTAS.master, "publication", "cycle") === 250);

console.log("Virada do dia em horário de BRASÍLIA (não UTC)");
// 2026-10-08 23:30 BRT = 2026-10-09 02:30 UTC. Ainda é dia 8 em Brasília.
const lateBrt = new Date("2026-10-09T02:30:00Z");
check("23:30 em Brasília ainda é o dia 08", saoPauloDayKey(lateBrt) === "2026-10-08");
// 2026-10-09 01:00 BRT = 2026-10-09 04:00 UTC. Já virou.
const afterMidnight = new Date("2026-10-09T04:00:00Z");
check("01:00 em Brasília já é o dia 09", saoPauloDayKey(afterMidnight) === "2026-10-09");
// Meia-noite UTC ainda é o dia ANTERIOR em Brasília (21:00).
check("21:00 em Brasília = 00:00 UTC ainda é o dia 08",
  saoPauloDayKey(new Date("2026-10-09T00:00:00Z")) === "2026-10-08");

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
