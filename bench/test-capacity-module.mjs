#!/usr/bin/env node
/**
 * TESTE — LIMITE DE ASSINANTES (importa o MÓDULO REAL)
 * =====================================================
 * Diferente de `bench/test-capacity.mjs` (que REIMPLEMENTA a decisão), este
 * script importa o módulo de produção `src/lib/billing/capacity.ts` diretamente
 * (Node 24 faz type-stripping nativo de `.ts`). É a prova de que a regra que
 * roda no servidor é EXATAMENTE a testada aqui.
 *
 * Uso: node bench/test-capacity-module.mjs
 */

import "./db-guard.mjs"; // trava: nunca tocar produção
import {
  decideCapacity,
  parseCapacityConfig,
  DEFAULT_CAPACITY,
} from "../src/lib/billing/capacity.ts";

let fails = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error("FAIL:", label, "->", JSON.stringify(a), "esperado", JSON.stringify(b));
    fails++;
  } else {
    console.log("ok  ", label);
  }
};

const open = { signupsOpen: true, maxPayers: 10, message: "Lotado." };
const none = (o = {}) => ({
  activePayers: 0,
  pendingReservations: 0,
  activeInvites: 0,
  buyerIsActivePayer: false,
  hasActiveInvite: false,
  ...o,
});

console.log("A última vaga (duas tentativas simultâneas)");
eq(
  decideCapacity({ config: open, usage: none({ activePayers: 9 }) }).reason,
  "OPEN",
  "1 vaga livre -> OPEN"
);
eq(
  decideCapacity({ config: open, usage: none({ activePayers: 9 }) }).seatsRemaining,
  1,
  "seatsRemaining = 1"
);
eq(
  decideCapacity({ config: open, usage: none({ activePayers: 9, pendingReservations: 1 }) }).reason,
  "AT_LIMIT",
  "reserva toma a vaga -> AT_LIMIT"
);
eq(
  decideCapacity({ config: open, usage: none({ activePayers: 10 }) }).reason,
  "AT_LIMIT",
  "used == max -> AT_LIMIT"
);

console.log("Vendas fechadas / renovação / convite");
eq(
  decideCapacity({ config: { ...open, signupsOpen: false }, usage: none() }).reason,
  "SIGNUPS_CLOSED",
  "fechado -> SIGNUPS_CLOSED"
);
eq(
  decideCapacity({
    config: { ...open, signupsOpen: false },
    usage: none({ activePayers: 10, buyerIsActivePayer: true }),
  }).reason,
  "EXISTING_PAYER",
  "cliente ativo renova mesmo lotado/fechado"
);
eq(
  decideCapacity({
    config: { ...open, signupsOpen: false },
    usage: none({ activePayers: 10, hasActiveInvite: true }),
  }).reason,
  "INVITED",
  "convite vence vendas fechadas e teto"
);

console.log("Ilimitado");
eq(
  decideCapacity({ config: { ...open, maxPayers: null }, usage: none({ activePayers: 9999 }) }).seatsRemaining,
  null,
  "sem teto -> seatsRemaining null"
);

console.log("Parser conservador");
eq(parseCapacityConfig({ signupsOpen: "false" }).signupsOpen, true, "string 'false' mantém aberto");
eq(parseCapacityConfig({ signupsOpen: false }).signupsOpen, false, "boolean false fecha");
eq(parseCapacityConfig("{bad").maxPayers, DEFAULT_CAPACITY.maxPayers, "JSON inválido -> default");
eq(parseCapacityConfig({ maxPayers: -3 }).maxPayers, null, "negativo -> null");
eq(parseCapacityConfig({ maxPayers: 0 }).maxPayers, 0, "zero é válido");

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK (módulo real)");
process.exit(fails ? 1 : 0);
