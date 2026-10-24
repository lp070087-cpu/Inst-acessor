#!/usr/bin/env node
/**
 * TESTE — OS SEIS PLANOS (consistência comercial)
 * ===============================================
 * Trava os preços definidos pelo proprietário e o estado de ativação, para que
 * nenhuma alteração futura mude silenciosamente o que é cobrado.
 *
 * Importa o CATÁLOGO REAL (Node type-stripping).
 * Uso: node --import "./db-guard.mjs"; // trava: nunca tocar produção
import ./bench/register-ts-alias.mjs bench/test-planos.mjs
 */
import { PLAN_CATALOG, LANDING_PLAN_ORDER, isLegacyPlan } from "../src/lib/billing/plans/catalog.ts";
import { PLAN_QUOTAS, LIMITS_ENFORCEMENT_ENABLED, quotaForPlan } from "../src/lib/billing/plans/limits.ts";
import { BASE_PRICE_CENTS } from "../src/lib/billing/promo.ts";

let pass = 0, fail = 0;
const check = (n, c, extra = "") => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${extra}`));
const bySlug = Object.fromEntries(PLAN_CATALOG.map((p) => [p.slug, p]));

console.log("Preços oficiais (definidos pelo proprietário)");
const ESPERADO = {
  semanal: 2700, start: 4300, essencial: 8700, pro: 12500, elite: 17100, master: 24800,
};
for (const [slug, cents] of Object.entries(ESPERADO)) {
  check(`${slug} = ${cents}c`, bySlug[slug]?.priceCents === cents, `atual=${bySlug[slug]?.priceCents}`);
}
console.log("Legados preservados (contratos/histórico)");
check("mensal = 7700c", bySlug.mensal?.priceCents === 7700);
check("anual = 54700c", bySlug.anual?.priceCents === 54700);
check("mensal marcado como legado", isLegacyPlan("mensal") === true);
check("anual marcado como legado", isLegacyPlan("anual") === true);
check("mensal/anual seguem ATIVOS (renovação)", bySlug.mensal?.active === true && bySlug.anual?.active === true);

console.log("Ciclo e tipo de cobrança");
check("semanal é pagamento ÚNICO", bySlug.semanal?.type === "ONE_TIME");
check("semanal dura 7 dias", bySlug.semanal?.durationDays === 7);
check("semanal sem intervalo de cobrança", bySlug.semanal?.billingInterval === null);
for (const slug of ["start", "essencial", "pro", "elite", "master"]) {
  check(`${slug} é assinatura MENSAL`, bySlug[slug]?.type === "RECURRING" && bySlug[slug]?.billingInterval === "MONTH");
}

console.log("Ativação comercial PENDENTE (nada vendido sem aprovação)");
for (const slug of ["start", "essencial", "pro", "elite", "master"]) {
  check(`${slug} está INATIVO`, bySlug[slug]?.active === false, `active=${bySlug[slug]?.active}`);
}
check("semanal ativo (plano vigente)", bySlug.semanal?.active === true);

console.log("Landing NÃO anuncia os planos novos (congelada)");
check("ordem da landing = 3 planos originais",
  JSON.stringify([...LANDING_PLAN_ORDER]) === JSON.stringify(["semanal", "mensal", "anual"]));
for (const slug of ["start", "essencial", "pro", "elite", "master"]) {
  check(`${slug} fora da landing`, !LANDING_PLAN_ORDER.includes(slug));
}

console.log("Franquias: modo SOMENTE MEDIÇÃO");
check("bloqueio desligado", LIMITS_ENFORCEMENT_ENABLED === false);
check("start 10/dia · 100/ciclo", PLAN_QUOTAS.start.aiPerDay === 10 && PLAN_QUOTAS.start.aiPerCycle === 100);
check("master 200/dia · 3000/ciclo", PLAN_QUOTAS.master.aiPerDay === 200 && PLAN_QUOTAS.master.aiPerCycle === 3000);
check("semanal sem franquia (comportamento atual)",
  quotaForPlan("semanal").aiPerCycle === null && quotaForPlan("semanal").aiPerDay === null);
check("legados sem franquia (não retroativo)",
  quotaForPlan("mensal").aiPerCycle === null && quotaForPlan("anual").aiPerCycle === null);

console.log("Preço usado pelo checkout = preço do catálogo");
for (const [slug, cents] of Object.entries(ESPERADO)) {
  check(`BASE_PRICE_CENTS[${slug}] coerente`, BASE_PRICE_CENTS[slug] === cents);
}

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
