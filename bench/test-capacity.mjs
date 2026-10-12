#!/usr/bin/env node
/**
 * TESTE — LIMITE DE ASSINANTES (núcleo puro)
 * ==========================================
 * Prova, sem banco, a decisão de vaga: o caso da ÚLTIMA VAGA (duas pessoas ao
 * mesmo tempo), vendas fechadas, renovação de cliente existente e convite.
 *
 * Reimplementa `decideCapacity` como está em `src/lib/billing/capacity.ts`.
 * Se a ordem das regras mudar no app, atualize aqui.
 *
 * Uso: node bench/test-capacity.mjs
 */

function decideCapacity({ config, usage }) {
  const max = config.maxPayers;
  const used =
    Math.max(0, usage.activePayers) +
    Math.max(0, usage.pendingReservations) +
    Math.max(0, usage.activeInvites);
  const seatsRemaining = max == null ? null : Math.max(0, max - used);

  if (usage.buyerIsActivePayer) {
    return { allowed: true, reason: "EXISTING_PAYER", seatsRemaining };
  }
  if (usage.hasActiveInvite) {
    return { allowed: true, reason: "INVITED", seatsRemaining };
  }
  if (!config.signupsOpen) {
    return { allowed: false, reason: "SIGNUPS_CLOSED", seatsRemaining };
  }
  if (max != null && used >= max) {
    return { allowed: false, reason: "AT_LIMIT", seatsRemaining };
  }
  return { allowed: true, reason: "OPEN", seatsRemaining };
}

const open = { signupsOpen: true, maxPayers: 10, message: "Lotado." };
const none = (o = {}) => ({
  activePayers: 0,
  pendingReservations: 0,
  activeInvites: 0,
  buyerIsActivePayer: false,
  hasActiveInvite: false,
  ...o,
});

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`);
  }
}

console.log("A ÚLTIMA VAGA — duas tentativas simultâneas");
// Teto 10; 9 pagantes + 1. A 1ª tentativa entra levando a reserva que ocupa a
// última vaga (nome fica 'used' = 10). A 2ª, avaliada com essa reserva já
// contabilizada, é recusada — é assim que o transação Serializable impede duas
// pessoas de pegarem a mesma vaga.
const lastFree = decideCapacity({ config: open, usage: none({ activePayers: 9 }) });
check("com 1 vaga livre → libera", lastFree.allowed === true && lastFree.reason === "OPEN");
check("resta exatamente 1 vaga", lastFree.seatsRemaining === 1);

const afterReserve = decideCapacity({
  config: open,
  usage: none({ activePayers: 9, pendingReservations: 1 }),
});
check("após a reserva tomar a vaga → recusa", afterReserve.allowed === false && afterReserve.reason === "AT_LIMIT");
check("zero vagas restantes", afterReserve.seatsRemaining === 0);

console.log("Reserva expirada libera a vaga");
// A reserva PENDING expirada não conta (não é passada em pendingReservations).
const expired = decideCapacity({ config: open, usage: none({ activePayers: 9 }) });
check("reserva expirada → vaga volta", expired.allowed === true);

console.log("Vendas fechadas pelo admin");
const closed = decideCapacity({
  config: { ...open, signupsOpen: false },
  usage: none({ activePayers: 0 }),
});
check("fechado abaixo do teto → recusa", closed.allowed === false && closed.reason === "SIGNUPS_CLOSED");

console.log("Renovação de cliente existente COM vendas fechadas");
const renew = decideCapacity({
  config: { ...open, signupsOpen: false },
  usage: none({ activePayers: 10, buyerIsActivePayer: true }),
});
check("cliente ativo renova mesmo lotado/fechado", renew.allowed === true && renew.reason === "EXISTING_PAYER");

console.log("Convite vigente");
const invited = decideCapacity({
  config: { ...open, signupsOpen: false },
  usage: none({ activePayers: 10, hasActiveInvite: true }),
});
check("convite vence vendas fechadas e teto", invited.allowed === true && invited.reason === "INVITED");

console.log("Ilimitado (maxPayers = null)");
const unlimited = decideCapacity({
  config: { ...open, maxPayers: null },
  usage: none({ activePayers: 9999 }),
});
check("sem teto → sempre libera", unlimited.allowed === true);
check("sem teto → seatsRemaining null (não é 0)", unlimited.seatsRemaining === null);

console.log("Teto exatamente atingido");
const exact = decideCapacity({ config: open, usage: none({ activePayers: 10 }) });
check("used == max → recusa", exact.allowed === false && exact.reason === "AT_LIMIT");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
