#!/usr/bin/env node
/**
 * TESTE — JANELAS DE FRANQUIA (rollover, expiração e concorrência)
 * ================================================================
 * Prova, sem banco, as regras que fazem o contador "virar sozinho":
 *   • a CHAVE do ciclo é ancorada no `startAt` — renovar gera chave nova, então
 *     o contador do ciclo anterior não é reutilizado (rollover);
 *   • depois de `expiresAt` a chave vira `"expired"` (fora de contrato ativo);
 *   • o plano Semanal (7 dias) expira ao fim da janela única;
 *   • `nextDailyReset` é SEMPRE futuro e cai na meia-noite de BRASÍLIA;
 *   • em concorrência, com `(limite-1)` usadas só UMA unidade passa — a segunda
 *     (que já veria o valor incrementado pela reserva atômica) é negada.
 *
 * Importa os MÓDULOS REAIS via Node (type-stripping) — não reimplementa a regra.
 *
 * Uso: node --import "./db-guard.mjs"; // trava: nunca tocar produção
import ./bench/register-ts-alias.mjs bench/test-usage-windows.mjs
 */
import {
  saoPauloDayKey,
  cycleKey,
  nextDailyReset,
  describeWindow,
} from "../src/lib/billing/usage/periods.ts";
import { evaluateQuota, PLAN_QUOTAS } from "../src/lib/billing/plans/limits.ts";

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n}`)); };

/** "HH:MM" no fuso de Brasília — para conferir que o reset cai na meia-noite. */
function saoPauloHM(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

console.log("(a) Rollover do ciclo — chave ancorada no startAt");
const k1 = cycleKey({
  startAt: new Date("2026-10-01T03:00:00Z"),
  expiresAt: null,
  now: new Date("2026-10-03T12:00:00Z"),
});
const k2 = cycleKey({
  startAt: new Date("2026-10-08T03:00:00Z"),
  expiresAt: null,
  now: new Date("2026-10-10T12:00:00Z"),
});
check("ciclo renovado gera chave DIFERENTE (contador reinicia)", k1 !== k2);
check("chave do ciclo usa a data do startAt", k1 === "c2026-10-01" && k2 === "c2026-10-08");
check(
  "mesmo ciclo mantém a MESMA chave durante toda a vigência",
  cycleKey({ startAt: new Date("2026-10-01T03:00:00Z"), expiresAt: null, now: new Date("2026-10-01T04:00:00Z") }) ===
    cycleKey({ startAt: new Date("2026-10-01T03:00:00Z"), expiresAt: null, now: new Date("2026-10-30T23:00:00Z") })
);

console.log("(b) Chave 'expired' depois do fim do contrato");
const exp = new Date("2026-10-09T03:00:00Z");
check(
  "antes do fim: ainda é a chave do contrato",
  cycleKey({ startAt: new Date("2026-10-02T03:00:00Z"), expiresAt: exp, now: new Date("2026-10-08T12:00:00Z") }) === "c2026-10-02"
);
check(
  "no exato instante de expiração JÁ é 'expired'",
  cycleKey({ startAt: new Date("2026-10-02T03:00:00Z"), expiresAt: exp, now: exp }) === "expired"
);
check(
  "depois do fim: 'expired'",
  cycleKey({ startAt: new Date("2026-10-02T03:00:00Z"), expiresAt: exp, now: new Date("2026-10-10T00:00:00Z") }) === "expired"
);

console.log("(c) Plano Semanal — janela única de 7 dias expira");
const weekStart = new Date("2026-10-01T03:00:00Z");
const weekEnd = new Date(weekStart.getTime() + 7 * 86400000); // 2026-10-08T03:00:00Z
check(
  "durante os 7 dias a chave NÃO é 'expired'",
  cycleKey({ startAt: weekStart, expiresAt: weekEnd, now: new Date("2026-10-05T12:00:00Z") }) !== "expired"
);
check(
  "ao fim dos 7 dias a chave VIRA 'expired' (sem rollover automático)",
  cycleKey({ startAt: weekStart, expiresAt: weekEnd, now: new Date("2026-10-08T03:00:01Z") }) === "expired"
);

console.log("(d) nextDailyReset — sempre futuro, meia-noite de Brasília");
const now = new Date("2026-10-08T15:00:00Z"); // 12:00 BRT no dia 08
const reset = nextDailyReset(now);
check("está no FUTURO", reset.getTime() > now.getTime());
check("cai na meia-noite (00:00) de Brasília", saoPauloHM(reset) === "00:00");
check("é o dia SEGUINTE em Brasília", saoPauloDayKey(reset) === "2026-10-09");

// Perto da virada (23:30 BRT) ainda cai na próxima meia-noite, e é futuro.
const lateNow = new Date("2026-10-09T02:30:00Z"); // 2026-10-08 23:30 BRT
const lateReset = nextDailyReset(lateNow);
check("23:30 BRT → reset é a meia-noite seguinte (futuro)", lateReset.getTime() > lateNow.getTime());
check("23:30 BRT → reset cai em 00:00 de Brasília", saoPauloHM(lateReset) === "00:00");
check("23:30 BRT → reset é o dia 09 em Brasília", saoPauloDayKey(lateReset) === "2026-10-09");

// Uma sequência de instantes no dia inteiro: o reset nunca retrocede.
const hours = [0, 3, 6, 9, 12, 15, 18, 21, 23];
const allFuture = hours.every((h) => {
  const t = new Date(Date.UTC(2026, 9, 8, h, 15, 0));
  return nextDailyReset(t).getTime() > t.getTime();
});
check("o reset é futuro em todos os horários do dia", allFuture);

console.log("describeWindow — rótulo humano da janela");
check("sem fim definido → null", describeWindow(null, now) === null);
check(
  "depois do fim → null",
  describeWindow(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-02T00:00:00Z")) === null
);
const label = describeWindow(new Date("2026-10-15T00:00:00Z"), new Date("2026-10-08T00:00:00Z"));
check("janela futura → 'Renova em …'", typeof label === "string" && label.includes("Renova em"));

console.log("(e) Concorrência — (limite-1) usadas libera UMA e nega a SEGUINTE");
const dailyLimit = PLAN_QUOTAS.start.aiPerDay; // 10
let used = dailyLimit - 1; // 9 — o saldo que DUAS requisições leriam antes do lock
const first = evaluateQuota({
  quota: PLAN_QUOTAS.start,
  feature: "ai_generation",
  usedToday: used,
  usedThisCycle: 0,
  enforcementEnabled: true,
});
check("com (limite-1) usadas, a PRÓXIMA unidade é permitida", first.allowed === true && first.remaining === 1);

// A reserva atômica incrementa ANTES da segunda requisição decidir — então a
// segunda enxerga `used === limit` (não mais `limit-1`) e é negada.
used += 1;
const second = evaluateQuota({
  quota: PLAN_QUOTAS.start,
  feature: "ai_generation",
  usedToday: used,
  usedThisCycle: 0,
  enforcementEnabled: true,
});
check("após a reserva, a SEGUNDA unidade é NEGADA (daily_limit)",
  second.allowed === false && second.reason === "daily_limit");

// Em modo medição a mesma entrada NÃO é bloqueada — o enforcement está off.
const measuring = evaluateQuota({
  quota: PLAN_QUOTAS.start,
  feature: "ai_generation",
  usedToday: used,
  usedThisCycle: 0,
  enforcementEnabled: false,
});
check("modo medição não bloqueia o mesmo cenário", measuring.allowed === true);

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
