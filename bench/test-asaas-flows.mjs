#!/usr/bin/env node
/**
 * ASAAS — FLUXOS SIMULADOS (OFFLINE) — TESTE DE REGRESSÃO PURO
 * ============================================================
 * Exercita as funções REAIS dos módulos de cobrança. NENHUMA chamada de rede,
 * NENHUMA cobrança, NENHUM banco, NENHUMA credencial.
 *
 * Uso:
 *   node --import ./bench/register-asaas-tests.mjs bench/test-asaas-flows.mjs
 *
 * TRAVA DE BANCO: a primeira linha abaixo (`./asaas-test-env.mjs`) aponta o
 * `DATABASE_URL` para um host inalcançável, para que NENHUM caminho do teste
 * toque um banco REAL (o `@prisma/client` carregaria `.env` = PRODUÇÃO).
 * Ver o cabeçalho desse arquivo.
 *
 * O `stub-loader.mjs` faz o mesmo que o `register-ts-alias.mjs` (alias `@/` +
 * extensão omitida) E adiciona um shim OFFLINE de `next/server` para que a ROTA
 * REAL do webhook (`src/app/api/webhooks/asaas/route.ts`) possa ser importada e
 * sua autenticação exercitada de verdade (o rate limiter é memória, o parser é
 * puro; só `handleAsaasEvent` toca o banco — e é a ÚLTIMA coisa, alcançada apenas
 * quando o token é VÁLIDO).
 *
 * REGRA DESTE ARQUIVO: nunca marcar como "passou" algo que exige a Sandbox do
 * Asaas ou o banco. Esses casos aparecem como [REQUER SANDBOX] / [REQUER DB].
 */

import "./asaas-test-env.mjs"; // TRAVA DE BANCO — deve vir PRIMEIRO (ver cabeçalho).
import { readFileSync } from "node:fs";

import {
  DEFAULT_PROMO,
  resolvePromoPrice,
  acceptableChargeAmounts,
  planPromoDisplay,
  parsePromoConfig,
} from "../src/lib/billing/promo.ts";
import { PLAN_CATALOG } from "../src/lib/billing/plans/catalog.ts";
import { parseAsaasWebhook } from "../src/lib/billing/asaas/webhook.ts";
import { decideCapacity } from "../src/lib/billing/capacity.ts";
import { handleAsaasEvent } from "../src/lib/billing/asaas/events.ts";
import { assessGrantCapacity } from "../src/lib/billing/capacity-db.ts";
import { POST as webhookPOST } from "../src/app/api/webhooks/asaas/route.ts";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") =>
  cond
    ? (pass++, console.log(`  ok   ${name}`))
    : (fail++, console.log(`  FAIL ${name} ${extra}`));

const priceOf = (slug) => PLAN_CATALOG.find((p) => p.slug === slug)?.priceCents;
const NOW = "2026-10-08T12:00:00.000Z";
const past = "2020-01-01T00:00:00.000Z";
const future = "2999-01-01T00:00:00.000Z";

// PREFLIGHT — a TRAVA DE BANCO está mesmo ativa? (nunca produção)
{
  const raw = process.env.DATABASE_URL || "";
  let host = "(unset)";
  try { host = new URL(raw).hostname; } catch { /* mantém */ }
  check("TRAVA: DB do teste é local/inalcançável (nunca produção)", host === "127.0.0.1", host);
}

// ---------------------------------------------------------------------------
// 1) PREÇO CALCULADO NO SERVIDOR — o cliente não tem voz
// ---------------------------------------------------------------------------
console.log("\n1) Preço resolvido 100% no servidor (valor do cliente é ignorado)");
{
  // `resolvePromoPrice` só aceita { slug, basePriceCents, config, history, now }.
  // Não existe campo de preço do cliente. Provamos injetando campos que um
  // navegador malicioso enviaria e mostrando que o resultado NÃO muda.
  const base = { slug: "mensal", basePriceCents: 7700, config: DEFAULT_PROMO, history: { confirmedPaymentsTotal: 0, confirmedMonthlyCharges: 0, confirmedYearlyCharges: 0, confirmedByPlan: {} }, now: NOW };
  const clean = resolvePromoPrice(base);
  const tampered = resolvePromoPrice({
    ...base,
    // campos que NÃO fazem parte da assinatura da função:
    priceCents: 1,
    clientPriceCents: 1,
    amountCents: 1,
    value: 0.01,
  });
  check("preço limpo = preço promocional do catálogo (4590)", clean.priceCents === 4590, String(clean.priceCents));
  check("preço com campos do cliente injetados NÃO muda", tampered.priceCents === clean.priceCents, `${tampered.priceCents}`);
  check("desconto idêntico (o cliente não afeta)", tampered.discountCents === clean.discountCents);

  // O preço sempre parte do catálogo (basePriceCents), nunca de um número solto.
  const noBase = resolvePromoPrice({ slug: "semanal", basePriceCents: 0, config: DEFAULT_PROMO, history: { confirmedPaymentsTotal: 0, confirmedMonthlyCharges: 0, confirmedYearlyCharges: 0, confirmedByPlan: {} }, now: NOW });
  check("base inválida (0) cai no preço do CATÁLOGO (2700)", noBase.basePriceCents === 2700, String(noBase.basePriceCents));
}

// ---------------------------------------------------------------------------
// 2) OS 6 PREÇOS OFICIAIS + tipo/intervalo
// ---------------------------------------------------------------------------
console.log("\n2) Os 6 planos cobram exatamente o preço do dono");
{
  const expected = {
    semanal: { cents: 2700, type: "ONE_TIME", interval: null },
    start: { cents: 4300, type: "RECURRING", interval: "MONTH" },
    essencial: { cents: 8700, type: "RECURRING", interval: "MONTH" },
    pro: { cents: 12500, type: "RECURRING", interval: "MONTH" },
    elite: { cents: 17100, type: "RECURRING", interval: "MONTH" },
    master: { cents: 24800, type: "RECURRING", interval: "MONTH" },
  };
  for (const [slug, exp] of Object.entries(expected)) {
    const p = PLAN_CATALOG.find((x) => x.slug === slug);
    check(`${slug}: preço = ${exp.cents}`, p?.priceCents === exp.cents, String(p?.priceCents));
    check(`${slug}: type = ${exp.type}`, p?.type === exp.type, String(p?.type));
    check(`${slug}: intervalo = ${exp.interval}`, p?.billingInterval === exp.interval, String(p?.billingInterval));
  }
}

// ---------------------------------------------------------------------------
// 3) PROMOÇÃO POR NÚMERO DE COBRANÇAS (recorrente, chargesAtPromoPrice: 3)
// ---------------------------------------------------------------------------
console.log("\n3) 1ª–3ª cobranças com desconto; a 4ª, preço cheio");
{
  const cfg = DEFAULT_PROMO; // mensal: promo 4590, chargesAtPromoPrice 3, cheio 7700
  const at = (used) =>
    resolvePromoPrice({
      slug: "mensal",
      basePriceCents: 7700,
      config: cfg,
      history: { confirmedPaymentsTotal: used, confirmedMonthlyCharges: used, confirmedYearlyCharges: 0, confirmedByPlan: { mensal: used } },
      now: NOW,
    });

  for (let used = 0; used <= 2; used++) {
    const r = at(used);
    check(`cobrança #${used + 1} pagou promocional (4590)`, r.priceCents === 4590 && r.applied === true, `price=${r.priceCents} applied=${r.applied}`);
  }
  check("1ª cobrança: restam 3 com desconto", at(0).remainingPromoCharges === 3, String(at(0).remainingPromoCharges));
  check("3ª cobrança: resta 1 com desconto", at(2).remainingPromoCharges === 1, String(at(2).remainingPromoCharges));

  const fourth = at(3);
  check("4ª cobrança: preço CHEIO (7700)", fourth.priceCents === 7700, String(fourth.priceCents));
  check("4ª cobrança: promoção NÃO aplicada", fourth.applied === false);
  check("4ª cobrança: motivo = LIMITE_DE_COBRANCAS_ATINGIDO", fourth.skipReason === "LIMITE_DE_COBRANCAS_ATINGIDO", String(fourth.skipReason));
}

// ---------------------------------------------------------------------------
// 4) COMPRA ÚNICA (semanal) vs RECORRENTE
// ---------------------------------------------------------------------------
console.log("\n4) Semanal é ONE_TIME (sem 'depois'); mensal é recorrente (com 'depois')");
{
  const r = resolvePromoPrice({
    slug: "semanal",
    basePriceCents: 2700,
    config: DEFAULT_PROMO,
    history: { confirmedPaymentsTotal: 0, confirmedMonthlyCharges: 0, confirmedYearlyCharges: 0, confirmedByPlan: {} },
    now: NOW,
  });
  check("semanal: cobra promocional 1190", r.priceCents === 1190, String(r.priceCents));
  check("semanal: sem cobranças seguintes (remaining = null)", r.remainingPromoCharges === null, String(r.remainingPromoCharges));

  const sem = planPromoDisplay({ slug: "semanal", basePriceCents: 2700, config: DEFAULT_PROMO, now: NOW });
  check("semanal: afterText = null (não há 'depois')", sem.afterText === null, String(sem.afterText));

  const men = planPromoDisplay({ slug: "mensal", basePriceCents: 7700, config: DEFAULT_PROMO, now: NOW });
  check("mensal: afterText existe (renovação)", typeof men.afterText === "string" && men.afterText.length > 0, String(men.afterText));
  check("mensal: afterText contém o preço cheio R$ 77,00", /77,00/.test(men.afterText ?? ""), String(men.afterText));

  // Histórico: quem já comprou paga cheio no semanal (exige primeira compra).
  const repeat = resolvePromoPrice({
    slug: "semanal",
    basePriceCents: 2700,
    config: DEFAULT_PROMO,
    history: { confirmedPaymentsTotal: 1, confirmedMonthlyCharges: 0, confirmedYearlyCharges: 0, confirmedByPlan: { semanal: 1 } },
    now: NOW,
  });
  check("semanal: quem já comprou paga cheio (2700)", repeat.priceCents === 2700, String(repeat.priceCents));
  check("semanal: motivo = NAO_E_PRIMEIRA_COMPRA", repeat.skipReason === "NAO_E_PRIMEIRA_COMPRA", String(repeat.skipReason));
}

// ---------------------------------------------------------------------------
// 5) PARSER DO WEBHOOK / IDEMPOTÊNCIA
// ---------------------------------------------------------------------------
console.log("\n5) eventId ESTÁVEL entre reentregas; desconhecidos e sem âncora são rejeitados");
{
  const payload = {
    event: "PAYMENT_CONFIRMED",
    payment: { id: "pay_ABC123", customer: "cus_1", subscription: "sub_9", value: 77.0, status: "CONFIRMED", externalReference: "instacessor:checkout:x" },
  };
  const a = parseAsaasWebhook(payload);
  const b = parseAsaasWebhook(JSON.parse(JSON.stringify(payload))); // reentrega idêntica
  check("evento conhecido é aceito", a && a.event === "PAYMENT_CONFIRMED");
  check("eventId = 'PAYMENT_CONFIRMED:pay_ABC123'", a?.eventId === "PAYMENT_CONFIRMED:pay_ABC123", String(a?.eventId));
  check("eventId ESTÁVEL na reentrega (idempotência)", a?.eventId === b?.eventId, `${a?.eventId} != ${b?.eventId}`);
  check("amountCents convertido (77.00 → 7700)", a?.amountCents === 7700, String(a?.amountCents));

  // Evento desconhecido → rejeitado.
  check("evento desconhecido → null", parseAsaasWebhook({ event: "PAYMENT_BANANA", payment: { id: "pay_1" } }) === null);
  check("evento não-string → null", parseAsaasWebhook({ event: 123 }) === null);
  check("payload nulo → null", parseAsaasWebhook(null) === null);
  check("payload array → null", parseAsaasWebhook([]) === null);

  // Sem nenhuma referência externa estável → rejeitado (idempotência fraca).
  check("sem id estável (só evento) → null", parseAsaasWebhook({ event: "PAYMENT_CONFIRMED" }) === null);
  check("payment vazio, sem ids → null", parseAsaasWebhook({ event: "PAYMENT_CONFIRMED", payment: {} }) === null);

  // Prioridade: payment.id manda sobre subscription/customer (mais específico).
  const prio = parseAsaasWebhook({
    event: "PAYMENT_CONFIRMED",
    payment: { id: "pay_1" },
    subscription: { id: "sub_1" },
    customer: { id: "cus_1" },
  });
  check("eventId prioriza payment.id", prio?.eventId === "PAYMENT_CONFIRMED:pay_1", String(prio?.eventId));
  check("ids externos extraídos (customer/sub/payment)", prio?.externalCustomerId === "cus_1" && prio?.externalSubscriptionId === "sub_1" && prio?.externalPaymentId === "pay_1");

  // CHECKOUT_* sem payment: cai no checkout.id.
  const chk = parseAsaasWebhook({ event: "CHECKOUT_PAID", checkout: { id: "chk_1" } });
  check("CHECKOUT_PAID usa checkout.id como âncora", chk?.eventId === "CHECKOUT_PAID:chk_1", String(chk?.eventId));

  // Nunca aceita evento fora da lista conhecida (não por regex).
  check("evento com nome parecido mas fora da lista → null", parseAsaasWebhook({ event: "payment_confirmed", payment: { id: "p" } }) === null);
}

// ---------------------------------------------------------------------------
// 6) VALORES LEGÍTIMOS DE COBRANÇA (webhook)
// ---------------------------------------------------------------------------
console.log("\n6) acceptableChargeAmounts: {cheio, promo} enquanto vigente; só {cheio} após vencer");
{
  const live = acceptableChargeAmounts({ slug: "mensal", basePriceCents: 7700, config: DEFAULT_PROMO, now: NOW });
  check("mensal vigente = [4590, 7700]", JSON.stringify(live) === JSON.stringify([4590, 7700]), JSON.stringify(live));

  const liveSem = acceptableChargeAmounts({ slug: "semanal", basePriceCents: 2700, config: DEFAULT_PROMO, now: NOW });
  check("semanal vigente = [1190, 2700]", JSON.stringify(liveSem) === JSON.stringify([1190, 2700]), JSON.stringify(liveSem));

  const expiredCfg = parsePromoConfig({ ...DEFAULT_PROMO, countdown: { active: true, endsAt: past, label: "x" } });
  const expired = acceptableChargeAmounts({ slug: "mensal", basePriceCents: 7700, config: expiredCfg, now: NOW });
  check("countdown VENCIDO → só [7700]", JSON.stringify(expired) === JSON.stringify([7700]), JSON.stringify(expired));

  const runningCfg = parsePromoConfig({ ...DEFAULT_PROMO, countdown: { active: true, endsAt: future, label: "x" } });
  const running = acceptableChargeAmounts({ slug: "mensal", basePriceCents: 7700, config: runningCfg, now: NOW });
  check("countdown ATIVO (futuro) → [4590, 7700]", JSON.stringify(running) === JSON.stringify([4590, 7700]), JSON.stringify(running));

  // Plano novo (promo desligada) → só o cheio.
  const start = acceptableChargeAmounts({ slug: "start", basePriceCents: 4300, config: DEFAULT_PROMO, now: NOW });
  check("start (promo desligada) → só [4300]", JSON.stringify(start) === JSON.stringify([4300]), JSON.stringify(start));

  // Nunca aceita valor fora do conjunto.
  check("valor R$ 1,00 NÃO é legítimo", !live.includes(100));
}

// ---------------------------------------------------------------------------
// 7) FORA DE ORDEM / IDEMPOTÊNCIA — o que É puro e o que exige DB
// ---------------------------------------------------------------------------
console.log("\n7) Guardas de replay/ordem (puro: âncora; DB: efeito)");
{
  check("handleAsaasEvent é exportado (fluxo real)", typeof handleAsaasEvent === "function");

  // A âncora de idempotência de 1º nível é o eventId do parser — já provado no
  // bloco 5 (estável entre reentregas). A idempotência de 2º nível (recusa de
  // reprocessar) vive na tabela `BillingEvent` (@@unique eventId) e no guard
  // `order.status === "PAID" && order.externalPaymentId === ...` dentro de
  // `applyOrderPayment` — ambos leem/escrevem o BANCO. Verificado por EVIDÊNCIA
  // DE FONTE (o teste não pode executá-los offline):
  const eventsSrc = readFileSync("src/lib/billing/asaas/events.ts", "utf8");
  check("guard de replay por pagamento pago existe (events.ts)", /order\.status === "PAID"[\s\S]{0,80}externalPaymentId/.test(eventsSrc));
  check("claim-first do evento existe (events.ts)", /billingEvent\.create/.test(eventsSrc) && /eventId: parsed\.eventId/.test(eventsSrc));

  // BUG REAL (defeito latente, detectado com o banco indisponível): quando o
  // `billingEvent.create` FALHA (banco fora), o `catch` chama
  // `billingEvent.findUnique` SEM guarda (events.ts:90). Se o banco também
  // falhar nessa segunda chamada, o erro ESCAPA de `handleAsaasEvent` e a rota
  // de webhook NÃO responde o 500 explícito documentado (regra 13) — lança.
  // A própria doc do arquivo descreve "falha ao aplicar → 5xx para o Asaas
  // reenviar", mas o caminho do `create` não tem try/catch em volta do
  // `findUnique`. Detectado de forma pura, sem tocar produção:
  const createIdx = eventsSrc.indexOf("billingEvent.create");
  const catchIdx = eventsSrc.indexOf("} catch {", createIdx);
  // Janela generosa: o comentário que documenta a correção fica entre o `catch`
  // e o `try`, então uma janela curta dava falso negativo.
  const afterCatch = eventsSrc.slice(catchIdx, catchIdx + 1200);
  const safelyWrapped =
    /try\s*\{[\s\S]{0,400}billingEvent\.findUnique/.test(afterCatch) ||
    /\?\?\s*null/.test(afterCatch);
  check(
    "CORRIGIDO: o catch do create protege o findUnique (queda do banco não escapa)",
    safelyWrapped,
    "o defeito latente voltou — a rota do webhook pode lançar em vez de devolver 500"
  );

  const schemaSrc = readFileSync("prisma/schema.prisma", "utf8");
  check("BillingEvent.eventId é @unique (schema)", /model BillingEvent[\s\S]*?eventId\s+String\s+@unique/.test(schemaSrc));
  check("Payment.eventId é @unique (schema)", /model Payment[\s\S]*?eventId\s+String\?\s+@unique/.test(schemaSrc));

  console.log("  [REQUER DB] replay real (2ª entrega do MESMO pagamento → 'duplicate_payment')");
  console.log("  [REQUER DB] 1ª compra → ordem vira PAID + AccessGrant (grant ACTIVE/PENDING_FIRST_ACCESS)");
  console.log("  [REQUER DB] renovação recorrente (2º pagamento na ordem paga → estende 1 ciclo)");
  console.log("  [REQUER DB] estorno (PAYMENT_REFUNDED → revoga SÓ o grant da cobrança estornada)");
  console.log("  [REQUER DB] 'processed=false' em falha (regra 13) e retry bem-sucedido");
}

// ---------------------------------------------------------------------------
// 8) AUTENTICAÇÃO DO WEBHOOK — ROTA REAL (offline, shim de next/server)
// ---------------------------------------------------------------------------
console.log("\n8) Token do webhook: só o header, fail-closed, 403 no token errado");
{
  const saved = { key: process.env.ASAAS_API_KEY, tok: process.env.ASAAS_WEBHOOK_TOKEN, env: process.env.ASAAS_ENV, url: process.env.ASAAS_BASE_URL };
  const req = (headers, body) =>
    new Request("https://example.test/api/webhooks/asaas", {
      method: "POST",
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  const VALID = "a".repeat(48); // 48 chars, sem espaços
  const PAYLOAD = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_x", externalReference: "r" } };

  try {
    // (a) Sem token configurado → 503 fail-closed.
    process.env.ASAAS_WEBHOOK_TOKEN = "";
    let res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.1" }, PAYLOAD));
    check("sem ASAAS_WEBHOOK_TOKEN → 503", res._status === 503, String(res._status));

    // A partir daqui o token está configurado.
    process.env.ASAAS_WEBHOOK_TOKEN = VALID;

    // (b) Token VÁLIDO + corpo inválido → 400. PROVA que a auth foi SUPERADA
    //     (a requisição passou do check de token e parou no parse do corpo),
    //     sem tocar o banco — logo determinístico e offline.
    res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.2" }, "{não é json"));
    check("token VÁLIDO supera a auth → 400 no corpo inválido", res._status === 400, String(res._status));

    // (b2) Token VÁLIDO + evento SEM âncora → 400 (também passou da auth).
    res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.2b" }, { event: "PAYMENT_CONFIRMED" }));
    check("token VÁLIDO supera a auth → 400 no evento sem âncora", res._status === 400, String(res._status));

    // (c) Token errado → 403.
    res = await webhookPOST(req({ "asaas-access-token": "b".repeat(48), "x-forwarded-for": "10.0.0.3" }, PAYLOAD));
    check("token ERRADO → 403", res._status === 403, String(res._status));

    // (d) Header ausente → 403 (mesmo com token configurado).
    res = await webhookPOST(req({ "x-forwarded-for": "10.0.0.4" }, PAYLOAD));
    check("header ausente → 403", res._status === 403, String(res._status));

    // (e) Token só na QUERY STRING é IGNORADO → 403.
    res = await webhookPOST(
      req({ "x-forwarded-for": "10.0.0.5" }, PAYLOAD),
      undefined
    );
    check("(controle) sem header, sem query → 403", res._status === 403, String(res._status));
    const withQuery = await webhookPOST(
      new Request(`https://example.test/api/webhooks/asaas?token=${VALID}`, {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.6" },
        body: JSON.stringify(PAYLOAD),
      })
    );
    check("token só na query string → 403 (não aceito)", withQuery._status === 403, String(withQuery._status));

    // (f) Token válido, corpo inválido (não-JSON) → 400.
    res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.7" }, "{isto não é json"));
    check("corpo não-JSON → 400", res._status === 400, String(res._status));

    // (g) Token válido, evento DESCONHECIDO → 400 (parser rejeita).
    res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.8" }, { event: "PAYMENT_BANANA", payment: { id: "p" } }));
    check("evento desconhecido → 400", res._status === 400, String(res._status));

    // (h) Token válido, evento SEM âncora estável → 400.
    res = await webhookPOST(req({ "asaas-access-token": VALID, "x-forwarded-for": "10.0.0.9" }, { event: "PAYMENT_CONFIRMED" }));
    check("evento sem âncora estável → 400", res._status === 400, String(res._status));
  } finally {
    if (saved.key === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY = saved.key;
    if (saved.tok === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN; else process.env.ASAAS_WEBHOOK_TOKEN = saved.tok;
    if (saved.env === undefined) delete process.env.ASAAS_ENV; else process.env.ASAAS_ENV = saved.env;
    if (saved.url === undefined) delete process.env.ASAAS_BASE_URL; else process.env.ASAAS_BASE_URL = saved.url;
  }
}

// ---------------------------------------------------------------------------
// 9) CAPACIDADE — pagamento confirmado nunca é recusado por falta de vaga
// ---------------------------------------------------------------------------
console.log("\n9) Sem vaga: acesso concedido mesmo assim (só auditoria)");
{
  const atLimit = { activePayers: 10, pendingReservations: 0, activeInvites: 0, hasActiveInvite: false, buyerIsActivePayer: false };
  const cfg = { signupsOpen: true, maxPayers: 10, message: "lotado" };
  const d = decideCapacity({ config: cfg, usage: atLimit });
  check("teto atingido: a DECISÃO bloqueia uma compra NOVA", d.allowed === false && d.reason === "AT_LIMIT", `${d.allowed}/${d.reason}`);
  check("seatsRemaining = 0 no teto", d.seatsRemaining === 0, String(d.seatsRemaining));

  // Mas o grant em si usa `assessGrantCapacity`, cuja invariante é allow:true.
  check("assessGrantCapacity é exportado (fluxo do grant)", typeof assessGrantCapacity === "function");
  const capDbSrc = readFileSync("src/lib/billing/capacity-db.ts", "utf8");
  check("assessGrantCapacity SEMPRE devolve allow:true (fonte)", /return \{ allow: true, overCapacity/.test(capDbSrc));
  check("over-capacity apenas registra aviso, não bloqueia (fonte)", /\[capacity\] acesso concedido acima do teto/.test(capDbSrc));

  // Renovação de quem JÁ é pagante não consome vaga nova → isento.
  const renew = decideCapacity({ config: cfg, usage: { ...atLimit, hasActiveInvite: false, buyerIsActivePayer: true } });
  check("renovação de pagante ativo é isenta (EXISTING_PAYER)", renew.allowed === true && renew.reason === "EXISTING_PAYER", `${renew.allowed}/${renew.reason}`);

  // Convite vigente reserva a vaga mesmo no teto.
  const invited = decideCapacity({ config: cfg, usage: { ...atLimit, hasActiveInvite: true } });
  check("convite vigente passa mesmo no teto (INVITED)", invited.allowed === true && invited.reason === "INVITED", `${invited.allowed}/${invited.reason}`);

  console.log("  [REQUER DB] grant criado de fato acima do teto (assessGrantCapacity best-effort)");
}

// ---------------------------------------------------------------------------
// 10) REQUER SANDBOX — o que NÃO dá para provar offline
// ---------------------------------------------------------------------------
console.log("\n10) Cobertura que exige a Sandbox do Asaas (não testada aqui)");
for (const line of [
  "renovação real de assinatura recorrente (o Asaas cobra o 2º ciclo)",
  "revogação real por estorno (PAYMENT_REFUNDED emitido pelo Asaas)",
  "geração real de URL de checkout hospedado (POST /v3/checkouts)",
  "reentrega/replay real e cabeçalho Retry-After do Asaas",
  "formato exato do header asaas-access-token na entrega real",
]) {
  console.log(`  [REQUER SANDBOX] ${line}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
