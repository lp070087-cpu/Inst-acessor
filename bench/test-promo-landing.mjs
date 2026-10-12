#!/usr/bin/env node
/**
 * REGRESSÃO — A LANDING NÃO PODE MUDAR
 * ====================================
 * A refatoração da pré-venda (3 → forma unificada de N planos) tocou
 * `planPromoDisplay`, que é EXATAMENTE o que a página de vendas usa para
 * montar os cards. Este teste trava os valores anunciados dos 3 planos da
 * landing, para que uma mudança futura não altere a página por acidente.
 *
 * Importa o MÓDULO REAL (Node type-stripping) — não reimplementa nada.
 *
 * Uso: node bench/test-promo-landing.mjs
 */
import "./db-guard.mjs"; // trava: nunca tocar produção
import { DEFAULT_PROMO, planPromoDisplay } from "../src/lib/billing/promo.ts";
import { PLAN_CATALOG, LANDING_PLAN_ORDER } from "../src/lib/billing/plans/catalog.ts";

let pass = 0, fail = 0;
const check = (n, c, extra = "") => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${extra}`));

const now = "2026-10-08T12:00:00.000Z";
const priceOf = (slug) => PLAN_CATALOG.find((p) => p.slug === slug)?.priceCents;

console.log("A landing continua com os 3 planos originais");
check("ordem da landing = semanal, mensal, anual",
  JSON.stringify([...LANDING_PLAN_ORDER]) === JSON.stringify(["semanal", "mensal", "anual"]),
  JSON.stringify(LANDING_PLAN_ORDER));
for (const slug of LANDING_PLAN_ORDER) {
  const p = PLAN_CATALOG.find((x) => x.slug === slug);
  check(`${slug} continua ativo na landing`, p?.active === true);
}
check("preço semanal = 2700", priceOf("semanal") === 2700);
check("preço mensal = 7700", priceOf("mensal") === 7700);
check("preço anual = 54700", priceOf("anual") === 54700);

console.log("Valores anunciados (com a pré-venda PADRÃO)");
const sem = planPromoDisplay({ slug: "semanal", basePriceCents: 2700, config: DEFAULT_PROMO, now });
check("semanal: promo R$ 11,90", sem.promoPriceCents === 1190, String(sem.promoPriceCents));
check("semanal: anuncia desconto", sem.showPromo === true);
check("semanal: sem 'depois' (compra única)", sem.afterText === null);

const men = planPromoDisplay({ slug: "mensal", basePriceCents: 7700, config: DEFAULT_PROMO, now });
check("mensal: promo R$ 45,90", men.promoPriceCents === 4590, String(men.promoPriceCents));
check("mensal: 'nas 3 primeiras cobranças'", men.qualifier === "nas 3 primeiras cobranças", String(men.qualifier));
check("mensal: 'Depois R$ 77,00/mês'", /77,00/.test(men.afterText ?? ""), String(men.afterText));

const anu = planPromoDisplay({ slug: "anual", basePriceCents: 54700, config: DEFAULT_PROMO, now });
check("anual: promo R$ 432,90", anu.promoPriceCents === 43290, String(anu.promoPriceCents));
check("anual: 'no primeiro ano'", anu.qualifier === "no primeiro ano", String(anu.qualifier));
check("anual: 'Renovação por R$ 547,00/ano'", /547,00/.test(anu.afterText ?? ""), String(anu.afterText));

console.log("Planos NOVOS não anunciam promoção inventada");
for (const slug of ["start", "essencial", "pro", "elite", "master"]) {
  const base = priceOf(slug);
  const d = planPromoDisplay({ slug, basePriceCents: base, config: DEFAULT_PROMO, now });
  check(`${slug}: sem promoção anunciada`, d.showPromo === false, `promo=${d.promoPriceCents}`);
  check(`${slug}: preço cheio preservado`, d.basePriceCents === base);
}

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
