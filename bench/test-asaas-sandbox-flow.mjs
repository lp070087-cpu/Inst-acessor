#!/usr/bin/env node
/**
 * ASAAS — FLUXO COMPLETO SIMULADO (API SANDBOX + WEBHOOKS) COM BANCO DESCARTÁVEL
 * ==============================================================================
 * Uso (usuário NÃO-root, ex.: `ci`):
 *   node bench/test-asaas-sandbox-flow.mjs
 *
 * O driver sobe um PostgreSQL embutido NOVO em loopback (`bench/local-postgres.mjs`,
 * banco `inst_acessor_audit`), aplica o schema atual e executa este mesmo arquivo
 * com `--child`. No filho, o `fetch` global é substituído por um simulador da API
 * Sandbox do Asaas (`https://api-sandbox.asaas.com/v3`) com respostas no formato
 * real; QUALQUER outra URL lança erro. Nenhuma chamada real ao Asaas, nenhuma
 * credencial real, nenhum banco real. `offline-network.cjs` bloqueia sockets
 * externos como segunda barreira.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');

if (!process.argv.includes('--child')) {
  const { LocalPostgres } = await import('./local-postgres.mjs');
  const { Client } = await import('pg');
  const require = createRequire(import.meta.url);
  const keep = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA', 'HOME']) {
    if (process.env[key]) keep[key] = process.env[key];
  }
  for (const key of Object.keys(process.env)) if (!(key in keep)) delete process.env[key];
  const port = await new Promise((done, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => done(value)); });
  });
  const folder = resolve(root, `outputs/asaas-sandbox-flow-postgres-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const postgres = new LocalPostgres(folder, port);
  const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit?connection_limit=8`;
  const env = {
    ...keep,
    DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port), NODE_ENV: 'test',
    TOKEN_ENCRYPTION_KEY: 'synthetic-asaas-flow-encryption-key-0123456789',
    NEXTAUTH_SECRET: 'synthetic-asaas-flow-session-secret', AUTH_URL: 'http://127.0.0.1:3107', NEXTAUTH_URL: 'http://127.0.0.1:3107',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3107',
    ASAAS_ENV: 'sandbox', ASAAS_API_KEY: '$aact_SYNTHETIC_SANDBOX_KEY_not_a_real_credential',
    ASAAS_CHECKOUT_ORIGIN: 'https://sandbox.asaas.com',
    ASAAS_WEBHOOK_TOKEN: 'synthetic-webhook-token-0123456789abcdefghijklmnop',
    PUBLISHING_WORKER_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"`,
  };
  const run = (args, extraEnv = env) => new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: extraEnv, windowsHide: true });
    let out = '', stdout = '';
    child.stdout.on('data', (d) => { out += d; stdout += d; }); child.stderr.on('data', (d) => { out += d; });
    child.once('error', reject); child.once('close', (code) => done({ code, out, stdout }));
  });
  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
    const prismaCli = resolve(require.resolve('prisma/package.json'), '..', 'build/index.js');
    const diff = await run([prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { ...env, NODE_OPTIONS: '' });
    assert.equal(diff.code, 0, diff.out.slice(-2000));
    const client = new Client({ connectionString: url.split('?')[0] });
    await client.connect();
    try { await client.query(diff.stdout); } finally { await client.end(); }
    const result = await run(['--import', './bench/register-ts-alias.mjs', 'bench/test-asaas-sandbox-flow.mjs', '--child']);
    mkdirSync(resolve(root, 'outputs/verification'), { recursive: true });
    writeFileSync(resolve(root, 'outputs/verification/test-asaas-sandbox-flow.log'), result.out);
    process.stdout.write(result.out);
    assert.equal(result.code, 0, 'child failed');
    assert.match(result.out, /\d+ Asaas sandbox-flow assertions passed/);
  } finally { await postgres.stop(); }
  process.exit(0);
}

// =============================================================================
// CHILD — runs against the disposable database only
// =============================================================================
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
assert.equal(target.pathname, '/inst_acessor_audit');

// ---- Asaas Sandbox API simulator (global fetch) ----------------------------
const SANDBOX = 'https://api-sandbox.asaas.com/v3';
const calls = [];
const sim = { delayMs: 0, failNext: null, customerSeq: 5219600, deleteFail: false };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(`${SANDBOX}/`)) throw new Error(`Simulator: network forbidden for ${url}`);
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.slice(SANDBOX.length);
  const body = init.body ? JSON.parse(init.body) : null;
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  calls.push({ method, path, body, headers });
  if (headers.access_token !== process.env.ASAAS_API_KEY) {
    return json(401, { errors: [{ code: 'invalid_access_token', description: 'A chave de API fornecida é inválida' }] });
  }
  if (sim.delayMs) await new Promise((r) => setTimeout(r, sim.delayMs));
  if (sim.failNext) { const f = sim.failNext; sim.failNext = null; return json(f.status, f.body); }
  if (method === 'POST' && path === '/checkouts') {
    const id = crypto.randomUUID();
    return json(200, {
      id, link: `https://sandbox.asaas.com/checkoutSession/show?id=${id}`, status: 'ACTIVE',
      billingTypes: body.billingTypes, chargeTypes: body.chargeTypes, minutesToExpire: body.minutesToExpire,
      externalReference: body.externalReference, callback: body.callback, items: body.items,
      customer: body.customer ?? null, subscription: body.subscription ?? null,
    });
  }
  if (method === 'POST' && path === '/customers') {
    return json(200, { object: 'customer', id: `cus_${String(sim.customerSeq++).padStart(12, '0')}`, dateCreated: '2026-10-24', name: body.name, email: body.email, deleted: false });
  }
  if (method === 'DELETE' && path.startsWith('/subscriptions/')) {
    if (sim.deleteFail) return json(400, { errors: [{ code: 'invalid_action', description: 'Assinatura não pode ser removida.' }] });
    return json(200, { deleted: true, id: path.split('/')[2] });
  }
  return json(404, { errors: [{ code: 'not_found', description: 'Recurso não encontrado' }] });
};

const { prisma } = await import('../src/lib/db.ts');
const { listPlans } = await import('../src/lib/billing/plans/index.ts');
const { startPublicCheckout } = await import('../src/lib/billing/asaas/checkout-order.ts');
const { ensureAsaasCustomer } = await import('../src/lib/billing/asaas/service.ts');
const { cancelRenewal } = await import('../src/lib/billing/subscriptions/index.ts');
const { resolvePremiumAccess } = await import('../src/lib/access/premium.ts');
const { requestFirstAccessToken, createFirstAccessAccount } = await import('../src/lib/first-access/index.ts');
const { POST: checkoutPOST } = await import('../src/app/api/billing/checkout/route.ts');
const { POST: webhookPOST } = await import('../src/app/api/webhooks/asaas/route.ts');

let checks = 0;
const check = (cond, name, extra = '') => { assert.ok(cond, `${name} ${extra}`); checks++; console.log(`ok ${name}`); };
const DAY = 86_400_000;
const today = new Date().toISOString().slice(0, 10);
const plusDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
const checkoutCalls = () => calls.filter((c) => c.method === 'POST' && c.path === '/checkouts');
let ipSeq = 1;
const buyer = (email, extra = {}) => ({ email, name: 'Comprador Sintético', cpfCnpj: '529.982.247-25', phone: '(11) 98765-4321', postalCode: '01310-100', address: 'Avenida Paulista', addressNumber: '1000', province: 'Bela Vista', ...extra });
const postCheckout = async (body) => {
  const res = await checkoutPOST(new Request('http://127.0.0.1:3107/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.1.0.${ipSeq++ % 250}` }, body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const hook = async (payload, { token = TOKEN, raw } = {}) => {
  const headers = { 'x-forwarded-for': `10.2.0.${ipSeq++ % 250}` };
  if (token !== null) headers['asaas-access-token'] = token;
  const res = await webhookPOST(new Request('http://127.0.0.1:3107/api/webhooks/asaas', { method: 'POST', headers, body: raw ?? JSON.stringify(payload) }));
  return { status: res.status, data: await res.json().catch(() => null) };
};
let evtSeq = 1000;
let paySeq = 80225913000;
/** Payload no formato real do webhook do Asaas (cobrança). */
const paymentEvent = (event, p) => ({
  id: `evt_${(evtSeq++).toString(16).padStart(32, '0')}&${368604000 + evtSeq}`,
  event, dateCreated: `${today} 10:00:00`,
  payment: {
    object: 'payment', id: p.id, dateCreated: today, customer: p.customer ?? 'cus_000005219999',
    subscription: p.subscription ?? null, installment: null, checkoutSession: p.checkoutSession ?? null,
    paymentLink: null, value: p.value, netValue: p.value ? Math.round(p.value * 97) / 100 : null,
    originalValue: null, interestValue: null, description: 'Inst Acessor', billingType: p.billingType ?? 'CREDIT_CARD',
    status: p.status ?? 'CONFIRMED', dueDate: p.date ?? today, originalDueDate: p.date ?? today,
    paymentDate: p.billingType === 'PIX' ? (p.date ?? today) : null, clientPaymentDate: p.date ?? today,
    confirmedDate: p.date ?? today, installmentNumber: null, invoiceUrl: `https://sandbox.asaas.com/i/${p.id.slice(4)}`,
    invoiceNumber: '06690512', externalReference: p.ref ?? null, deleted: false, anticipated: false, anticipable: false,
    creditDate: plusDays(p.date ?? today, 32), estimatedCreditDate: plusDays(p.date ?? today, 32),
    transactionReceiptUrl: null, nossoNumero: null, bankSlipUrl: null, lastInvoiceViewedDate: null, lastBankSlipViewedDate: null,
    discount: { value: 0, limitDate: null, dueDateLimitDays: 0, type: 'FIXED' }, fine: { value: 0, type: 'FIXED' },
    interest: { value: 0, type: 'PERCENTAGE' }, postalService: false, custody: null, refunds: null,
    creditCard: p.billingType === 'PIX' ? undefined : { creditCardNumber: '8829', creditCardBrand: 'MASTERCARD', creditCardToken: 'a75a1d98-c52d-4a6b-a413-71e00b193c99' },
  },
});
const newPayId = () => `pay_${paySeq++}`;
const orderByRef = (externalReference) => prisma.checkoutOrder.findUnique({ where: { externalReference } });
const orderFromUrl = async (url) => prisma.checkoutOrder.findFirst({ where: { externalCheckoutId: new URL(url).searchParams.get('id') } });

// =============================================================================
// 2) PLANOS — preço do banco/catálogo; só os ativos são vendáveis
// =============================================================================
await listPlans(); // self-heal do catálogo no banco descartável
const dbPlans = Object.fromEntries((await prisma.plan.findMany()).map((p) => [p.slug, p]));
check(dbPlans.semanal?.priceCents === 2700 && dbPlans.semanal.type === 'ONE_TIME' && dbPlans.semanal.durationDays === 7 && dbPlans.semanal.active, 'Plano semanal ativo 2700 ONE_TIME 7 dias');
check(dbPlans.mensal?.priceCents === 7700 && dbPlans.mensal.billingInterval === 'MONTH' && dbPlans.mensal.active, 'Plano mensal ativo 7700 RECURRING MONTH');
check(dbPlans.anual?.priceCents === 54700 && dbPlans.anual.billingInterval === 'YEAR' && dbPlans.anual.durationDays === 365 && dbPlans.anual.active, 'Plano anual ativo 54700 RECURRING YEAR');
check(['start', 'essencial', 'pro', 'elite', 'master'].every((s) => dbPlans[s] && dbPlans[s].active === false), 'Planos novos existem e estão INATIVOS');

let before = checkoutCalls().length;
let r = await postCheckout({ planId: 'plan:start', ...buyer('inativo@audit.invalid') });
check(r.status === 404 && checkoutCalls().length === before, 'Plano inativo (planId) rejeitado sem chamar o Asaas', String(r.status));
r = await postCheckout({ planId: dbPlans.start.id, ...buyer('inativo@audit.invalid') });
check(r.status === 404 && checkoutCalls().length === before, 'Plano inativo (id do banco) rejeitado sem chamar o Asaas');
r = await postCheckout({ planSlug: 'start', ...buyer('inativo@audit.invalid') });
check(r.status === 400 && checkoutCalls().length === before, 'planSlug fora da lista vendável rejeitado (400)');
r = await postCheckout({ planId: 'plan:inexistente', ...buyer('inativo@audit.invalid') });
check(r.status === 404 && checkoutCalls().length === before, 'Plano inexistente rejeitado');
r = await postCheckout({ planSlug: 'semanal', ...buyer('dados@audit.invalid', { cpfCnpj: '' }) });
check(r.status === 400 && checkoutCalls().length === before, 'Comprador anônimo sem CPF rejeitado antes de chamar o Asaas');

// =============================================================================
// 1/3/4) CHECKOUT — cobrança avulsa (semanal) e assinatura (mensal/anual)
// =============================================================================
r = await postCheckout({ planSlug: 'semanal', ...buyer('anon@audit.invalid'), priceCents: 1, value: 0.01, amountCents: 1, expectedAmountCents: 1 });
let call = checkoutCalls().at(-1);
check(r.status === 200 && r.data.ok === true, 'Checkout semanal anônimo criado (200)', JSON.stringify(r.data));
check(r.data.checkout.checkoutUrl === `https://sandbox.asaas.com/checkoutSession/show?id=${new URL(r.data.checkout.checkoutUrl).searchParams.get('id')}`, 'Resposta traz URL do checkout hospedado Sandbox para redirecionar');
check(r.data.checkout.amountCents === 1190 && call.body.value === 11.9 && call.body.items[0].value === 11.9, 'Valor cobrado = promo do servidor (R$ 11,90); campos de preço do cliente ignorados', `${r.data.checkout.amountCents}/${call.body.value}`);
check(call.body.chargeTypes[0] === 'DETACHED' && !call.body.subscription, 'Semanal = cobrança AVULSA (DETACHED, sem subscription)');
check(JSON.stringify(call.body.billingTypes) === '["PIX","CREDIT_CARD"]', 'Semanal aceita PIX e cartão');
check(/^instacessor:checkout:anon@audit\.invalid:[0-9a-f-]{36}$/.test(call.body.externalReference), 'externalReference única e rastreável');
check(call.body.customerData?.email === 'anon@audit.invalid' && call.body.customerData.cpfCnpj === '52998224725' && call.body.customerData.phone === '11987654321' && !call.body.customer, 'Customer novo via customerData (normalizado), sem customer duplicado');
check(call.body.callback.successUrl.includes('/checkout/retorno?status=sucesso&referencia=') && call.body.callback.cancelUrl.includes('status=cancelado'), 'Callbacks de retorno apontam para /checkout/retorno');
check(call.headers['content-type'] === 'application/json' && call.headers.access_token === process.env.ASAAS_API_KEY, 'Headers da API Asaas (access_token server-side)');
const semOrder = await orderByRef(call.body.externalReference);
check(semOrder.status === 'PENDING' && semOrder.expectedAmountCents === 1190 && semOrder.externalCheckoutId === new URL(r.data.checkout.checkoutUrl).searchParams.get('id'), 'Ordem local PENDING com valor travado e id do checkout');
check(await prisma.accessGrant.count({ where: { email: 'anon@audit.invalid' } }) === 0, 'Criar checkout NÃO libera acesso');

r = await postCheckout({ planSlug: 'mensal', ...buyer('mensal-anon@audit.invalid') });
call = checkoutCalls().at(-1);
check(r.status === 200 && call.body.chargeTypes[0] === 'RECURRENT' && call.body.subscription?.cycle === 'MONTHLY' && call.body.value === 45.9, 'Mensal = assinatura RECURRENT MONTHLY R$ 45,90 (promo)');
check(JSON.stringify(call.body.billingTypes) === '["CREDIT_CARD"]', 'Assinatura recorrente só cartão');
r = await postCheckout({ planSlug: 'anual', ...buyer('anual-anon@audit.invalid') });
call = checkoutCalls().at(-1);
check(r.status === 200 && call.body.subscription?.cycle === 'YEARLY' && call.body.value === 432.9, 'Anual = assinatura RECURRENT YEARLY R$ 432,90 (promo)');

// Promo desligada pelo admin → preço CHEIO do banco.
await prisma.systemSetting.upsert({ where: { key: 'billing.promo.v1' }, update: { value: JSON.stringify({ enabled: false }) }, create: { key: 'billing.promo.v1', value: JSON.stringify({ enabled: false }) } });
for (const [slug, cents] of [['semanal', 2700], ['mensal', 7700], ['anual', 54700]]) {
  r = await postCheckout({ planSlug: slug, ...buyer(`cheio-${slug}@audit.invalid`) });
  call = checkoutCalls().at(-1);
  check(r.data.checkout?.amountCents === cents && call.body.value === cents / 100, `Promo desligada: ${slug} cobra ${cents} centavos`);
}
await prisma.systemSetting.delete({ where: { key: 'billing.promo.v1' } });

// Falha do Asaas → ordem FAILED, sem URL, nada liberado.
sim.failNext = { status: 400, body: { errors: [{ code: 'invalid_customer.cpfCnpj', description: 'O CPF/CNPJ informado é inválido.' }] } };
r = await postCheckout({ planSlug: 'semanal', ...buyer('falha@audit.invalid') });
check(r.status === 400 && r.data.checkoutUrl === null, 'Erro da API Asaas → 400 sem URL');
check((await prisma.checkoutOrder.findFirst({ where: { email: 'falha@audit.invalid' } })).status === 'FAILED', 'Erro da API Asaas → ordem FAILED');

// =============================================================================
// 9) DUPLICIDADE — duplo clique / concorrência
// =============================================================================
before = checkoutCalls().length;
sim.delayMs = 400;
const twin = await Promise.all([postCheckout({ planSlug: 'mensal', ...buyer('duplo@audit.invalid') }), postCheckout({ planSlug: 'mensal', ...buyer('duplo@audit.invalid') })]);
sim.delayMs = 0;
check(checkoutCalls().length === before + 1, 'Duplo clique simultâneo cria UMA cobrança no Asaas', String(checkoutCalls().length - before));
check(twin.some((x) => x.status === 200) && twin.every((x) => x.status === 200 || (x.status === 409 && x.data.reason === 'in_progress')), 'Segundo clique: mesma URL ou 409 em andamento', JSON.stringify(twin.map((x) => x.status)));
const firstUrl = twin.find((x) => x.status === 200).data.checkout.checkoutUrl;
r = await postCheckout({ planSlug: 'mensal', ...buyer('duplo@audit.invalid') });
check(r.status === 200 && r.data.checkout.checkoutUrl === firstUrl && checkoutCalls().length === before + 1, 'Novo clique reaproveita o MESMO checkout (sem nova cobrança)');
check(await prisma.checkoutOrder.count({ where: { email: 'duplo@audit.invalid' } }) === 1, 'Apenas uma ordem para o mesmo comprador+plano');
r = await postCheckout({ planSlug: 'mensal', ...buyer('duplo@audit.invalid', { cpfCnpj: '111.444.777-35', phone: '(21) 99876-5432' }) });
check(r.status === 200 && r.data.checkout.checkoutUrl !== firstUrl && checkoutCalls().length === before + 2, 'Mesmo e-mail com OUTROS dados não recebe o checkout de terceiros');
r = await postCheckout({ planSlug: 'anual', ...buyer('duplo@audit.invalid') });
check(r.status === 200 && checkoutCalls().length === before + 3, 'Outro plano do mesmo comprador = novo checkout');

// =============================================================================
// 5) WEBHOOK — autenticação, validação, replay
// =============================================================================
const semPay = newPayId();
const confirmSem = paymentEvent('PAYMENT_RECEIVED', { id: semPay, value: 11.9, ref: semOrder.externalReference, billingType: 'PIX', status: 'RECEIVED' });
check((await hook(confirmSem, { token: null })).status === 403, 'Webhook sem header asaas-access-token → 403');
check((await hook(confirmSem, { token: TOKEN.slice(0, -1) + 'X' })).status === 403, 'Webhook com token errado (mesmo tamanho) → 403');
check((await hook(confirmSem, { token: TOKEN + 'extra' })).status === 403, 'Webhook com token de outro tamanho → 403');
check((await hook(confirmSem, { token: process.env.ASAAS_API_KEY })).status === 403, 'API key não serve como token do webhook');
check(await prisma.accessGrant.count({ where: { externalPaymentId: semPay } }) === 0, 'Nenhum efeito com token inválido');
check((await hook(null, { raw: '{"event":' })).status === 400, 'JSON malformado → 400');
check((await hook({ event: 'PAYMENT_BANANA', payment: { id: 'pay_x' } })).status === 400, 'Evento inventado → 400');
check((await hook({ event: 'PAYMENT_CONFIRMED', payment: {} })).status === 400, 'Evento sem âncora estável → 400');
const viewed = await hook(paymentEvent('PAYMENT_CHECKOUT_VIEWED', { id: newPayId(), value: 11.9, ref: semOrder.externalReference }));
check(viewed.status === 200, 'Evento oficial sem efeito (PAYMENT_CHECKOUT_VIEWED) → 200 (não pausa a fila do Asaas)', String(viewed.status));
const savedToken = process.env.ASAAS_WEBHOOK_TOKEN;
process.env.ASAAS_WEBHOOK_TOKEN = '';
check((await hook(confirmSem)).status === 503, 'Sem ASAAS_WEBHOOK_TOKEN → 503 fail-closed');
process.env.ASAAS_WEBHOOK_TOKEN = savedToken;

// =============================================================================
// 6/7) PAGAMENTO CONFIRMADO → ACESSO (anônimo: semanal via PIX)
// =============================================================================
let w = await hook(confirmSem);
check(w.status === 200 && w.data.duplicate === false, 'PAYMENT_RECEIVED (PIX) aceito');
const semPaid = await orderByRef(semOrder.externalReference);
check(semPaid.status === 'PAID' && semPaid.externalPaymentId === semPay, 'Ordem semanal → PAID');
let grant = await prisma.accessGrant.findFirst({ where: { externalPaymentId: semPay } });
check(grant.status === 'PENDING_FIRST_ACCESS' && grant.userId === null && grant.email === 'anon@audit.invalid', 'Comprador sem conta → grant PENDING_FIRST_ACCESS por e-mail');
check(grant.expiresAt.getTime() === Date.parse(today) + 7 * DAY, 'Semanal: expira em exatamente 7 dias após o pagamento');
w = await hook(confirmSem);
check(w.status === 200 && w.data.duplicate === true, 'Replay do MESMO evento (mesmo id) → duplicate, sem reprocessar');
check(await prisma.billingEvent.count({ where: { eventId: confirmSem.id } }) === 1, 'BillingEvent único por id de evento');
const stored = await prisma.billingEvent.findUnique({ where: { eventId: confirmSem.id } });
check(!JSON.stringify(stored.payload).includes('creditCardToken') && stored.processed === true, 'Payload persistido sanitizado e processed=true');
const confirmAfterReceived = paymentEvent('PAYMENT_CONFIRMED', { id: semPay, value: 11.9, ref: semOrder.externalReference, billingType: 'PIX' });
await hook(confirmAfterReceived);
check(await prisma.accessGrant.count({ where: { externalPaymentId: semPay } }) === 1, 'CONFIRMED + RECEIVED do mesmo pagamento não duplicam acesso');
const activationToken = await requestFirstAccessToken('anon@audit.invalid');
check(activationToken.tokenCreated === true, 'Grant pago permite emitir o token de primeiro acesso');
const activation = await createFirstAccessAccount({ token: activationToken.rawToken, password: 'SyntheticAsaasFlow123!', confirmPassword: 'SyntheticAsaasFlow123!' });
check(activation.ok === true, 'Primeiro acesso cria a conta do comprador', JSON.stringify(activation));
const anonUser = await prisma.user.findUnique({ where: { email: 'anon@audit.invalid' } });
let access = await resolvePremiumAccess(anonUser.id);
check(access.hasAccess === true && access.reason === 'GRANT' && access.expiresAt === grant.expiresAt.toISOString(), 'Após o primeiro acesso: premium liberado até o fim dos 7 dias', JSON.stringify(access));

// Duração vencida: semanal pago há 10 dias.
const oldRes = await postCheckout({ planSlug: 'semanal', ...buyer('vencido@audit.invalid') });
const oldOrder = await orderFromUrl(oldRes.data.checkout.checkoutUrl);
await hook(paymentEvent('PAYMENT_RECEIVED', { id: newPayId(), value: oldOrder.expectedAmountCents / 100, ref: oldOrder.externalReference, billingType: 'PIX', date: plusDays(today, -10) }));
const oldUser = await prisma.user.create({ data: { email: 'vencido@audit.invalid', firstAccessCompleted: true } });
access = await resolvePremiumAccess(oldUser.id);
check(access.hasAccess === false && access.reason === 'EXPIRED', 'Semanal pago há 10 dias: acesso EXPIRADO', JSON.stringify(access));

// Valor adulterado não libera.
const tamperRes = await postCheckout({ planSlug: 'semanal', ...buyer('adulterado@audit.invalid') });
const tamperOrder = await orderFromUrl(tamperRes.data.checkout.checkoutUrl);
const tamperPay = newPayId();
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: tamperPay, value: 1.0, ref: tamperOrder.externalReference }));
check(await prisma.accessGrant.count({ where: { externalPaymentId: tamperPay } }) === 0 && (await orderByRef(tamperOrder.externalReference)).status === 'PENDING', 'Valor divergente (R$ 1,00) nunca libera acesso');

// =============================================================================
// 1/6/7/10) USUÁRIO AUTENTICADO — mensal, customer reaproveitado, renovação
// =============================================================================
const member = await prisma.user.create({ data: { email: 'membro@audit.invalid', name: 'Membro', emailVerified: new Date(), firstAccessCompleted: true } });
access = await resolvePremiumAccess(member.id);
check(access.hasAccess === false && access.reason === 'NO_ACCESS', 'Conta gratuita sem pagamento: sem premium');
let res = await startPublicCheckout({ email: member.email, name: member.name, planId: 'plan:mensal', userId: member.id, reuseStoredCustomer: true });
call = checkoutCalls().at(-1);
check(res.ok && call.body.customerData?.email === member.email && !call.body.customer, '1ª compra autenticada sem customer salvo → customerData');
const memberOrder = await orderByRef(call.body.externalReference);
check(memberOrder.externalReference.startsWith(`instacessor:checkout-session:${member.id}:`), 'Checkout de sessão recebe marcador durável na externalReference');
const SUB = 'sub_VXJBYgP2u0eO';
const CUS = 'cus_000005219613';
await hook({ id: `evt_sub_created_${SUB}`, event: 'SUBSCRIPTION_CREATED', dateCreated: `${today} 10:00:00`, subscription: { object: 'subscription', id: SUB, customer: CUS, billingType: 'CREDIT_CARD', cycle: 'MONTHLY', value: 45.9, nextDueDate: today, status: 'ACTIVE', externalReference: memberOrder.externalReference, deleted: false } });
check((await orderByRef(memberOrder.externalReference)).externalSubscriptionId === SUB, 'SUBSCRIPTION_CREATED vincula a assinatura Asaas à ordem');
access = await resolvePremiumAccess(member.id);
check(access.hasAccess === false, 'Assinatura criada sem pagamento confirmado: sem premium');
const pay1 = newPayId();
w = await hook(paymentEvent('PAYMENT_CONFIRMED', { id: pay1, value: 45.9, ref: memberOrder.externalReference, subscription: SUB, customer: CUS }));
check(w.status === 200, 'PAYMENT_CONFIRMED (cartão) da 1ª mensalidade aceito');
let sub = await prisma.subscription.findFirst({ where: { userId: member.id } });
check(sub.status === 'ACTIVE' && sub.autoRenew === true && sub.externalSubscriptionId === SUB && sub.amountCents === 4590, 'Subscription ACTIVE, autoRenew, valor travado 4590');
check(sub.expiresAt.getTime() === Date.parse(today) + 30 * DAY, 'Mensal: expira 30 dias após o pagamento');
check((await prisma.payment.findFirst({ where: { externalPaymentId: pay1 } }))?.amountCents === 4590, 'Payment PAID registrado com o valor cobrado');
check((await prisma.user.findUnique({ where: { id: member.id } })).asaasCustomerId === CUS, 'CORREÇÃO: customer do Asaas vinculado ao User após o pagamento');
access = await resolvePremiumAccess(member.id);
check(access.hasAccess === true && access.reason === 'GRANT', 'Premium liberado após pagamento confirmado');

res = await startPublicCheckout({ email: member.email, name: member.name, planId: 'plan:anual', userId: member.id, reuseStoredCustomer: true });
call = checkoutCalls().at(-1);
check(res.ok && call.body.customer === CUS && !call.body.customerData, '2ª compra autenticada reutiliza o customer (sem customer duplicado)');
r = await postCheckout({ planSlug: 'anual', ...buyer(member.email) });
call = checkoutCalls().at(-1);
check(r.status === 200 && !call.body.customer && call.body.customerData?.email === member.email, 'Anônimo digitando e-mail de um User NÃO usa o customer salvo dele');
before = calls.filter((c) => c.path === '/customers').length;
const legacy1 = await ensureAsaasCustomer({ userId: anonUser.id, email: anonUser.email, name: 'Anon' });
const legacy2 = await ensureAsaasCustomer({ userId: anonUser.id, email: anonUser.email, name: 'Anon' });
check(legacy1 === legacy2 && calls.filter((c) => c.path === '/customers').length === before + 1, 'Serviço legado: POST /customers uma única vez e reutiliza o id');

// Renovação: 2º ciclo pago no vencimento estende a partir do fim do período vigente.
const prevExpiry = sub.expiresAt.getTime();
const pay2 = newPayId();
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: pay2, value: 45.9, ref: memberOrder.externalReference, subscription: SUB, customer: CUS, date: plusDays(today, 30) }));
sub = await prisma.subscription.findFirst({ where: { userId: member.id } });
check(sub.expiresAt.getTime() === prevExpiry + 30 * DAY, 'Renovação estende exatamente +30 dias');
check(await prisma.payment.count({ where: { userId: member.id } }) === 2 && await prisma.accessGrant.count({ where: { email: member.email } }) === 2, 'Renovação gera novo Payment e novo grant (histórico preservado)');
// Fim da promoção: 4ª cobrança pelo preço CHEIO (R$ 77,00) deve continuar liberando.
const pay3 = newPayId();
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: pay3, value: 77.0, ref: memberOrder.externalReference, subscription: SUB, customer: CUS, date: plusDays(today, 60) }));
sub = await prisma.subscription.findFirst({ where: { userId: member.id } });
check(sub.expiresAt.getTime() === prevExpiry + 60 * DAY && await prisma.accessGrant.count({ where: { externalPaymentId: pay3 } }) === 1, 'CORREÇÃO: renovação pelo preço cheio (após a pré-venda) é aceita');
check((await prisma.payment.findFirst({ where: { externalPaymentId: pay3 } }))?.amountCents === 7700, 'Renovação pelo preço cheio registra o valor REAL cobrado (7700)');
const payBad = newPayId();
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: payBad, value: 50.0, ref: memberOrder.externalReference, subscription: SUB, customer: CUS, date: plusDays(today, 90) }));
check(await prisma.accessGrant.count({ where: { externalPaymentId: payBad } }) === 0, 'Renovação com valor arbitrário é recusada');
// Renovação sem externalReference (só id da assinatura).
const pay4 = newPayId();
await hook(paymentEvent('PAYMENT_RECEIVED', { id: pay4, value: 77.0, subscription: SUB, customer: CUS, date: plusDays(today, 90) }));
sub = await prisma.subscription.findFirst({ where: { userId: member.id } });
check(sub.expiresAt.getTime() === prevExpiry + 90 * DAY, 'Renovação sem externalReference (pela assinatura) estende +30 dias');

// 8) Inadimplência: PAST_DUE sem apagar período pago.
const overduePay = newPayId();
await hook(paymentEvent('PAYMENT_OVERDUE', { id: overduePay, value: 77.0, ref: memberOrder.externalReference, subscription: SUB, customer: CUS, status: 'OVERDUE', date: plusDays(today, 120) }));
sub = await prisma.subscription.findFirst({ where: { userId: member.id } });
check(sub.status === 'PAST_DUE' && await prisma.accessGrant.count({ where: { externalPaymentId: overduePay } }) === 0, 'PAYMENT_OVERDUE → PAST_DUE e nenhum acesso novo');
access = await resolvePremiumAccess(member.id);
check(access.hasAccess === true, 'Período já pago continua válido durante a inadimplência');

// 10) Cancelamento da renovação (usuário) → DELETE no Asaas; histórico mantido.
const other = await prisma.user.create({ data: { email: 'intruso@audit.invalid', firstAccessCompleted: true } });
before = calls.filter((c) => c.method === 'DELETE').length;
let cancel = await cancelRenewal(other.id, sub.id);
check(cancel.ok === false && cancel.reason === 'not_found' && calls.filter((c) => c.method === 'DELETE').length === before, 'Cancelamento de assinatura alheia recusado sem chamar o Asaas');
sim.deleteFail = true;
cancel = await cancelRenewal(member.id, sub.id);
sim.deleteFail = false;
check(cancel.ok === false && cancel.reason === 'gateway' && (await prisma.subscription.findUnique({ where: { id: sub.id } })).autoRenew === true, 'Falha do Asaas no cancelamento não altera o banco local');
cancel = await cancelRenewal(member.id, sub.id);
const del = calls.filter((c) => c.method === 'DELETE').at(-1);
check(cancel.ok === true && del.path === `/subscriptions/${SUB}`, 'Cancelamento chama DELETE /v3/subscriptions/{id}');
await hook({ id: `evt_sub_deleted_${SUB}`, event: 'SUBSCRIPTION_DELETED', dateCreated: `${today} 11:00:00`, subscription: { object: 'subscription', id: SUB, customer: CUS, status: 'INACTIVE', deleted: true, externalReference: memberOrder.externalReference } });
sub = await prisma.subscription.findUnique({ where: { id: sub.id } });
check(sub.autoRenew === false && sub.canceledAt !== null, 'SUBSCRIPTION_DELETED: renovação cancelada');
check(await prisma.payment.count({ where: { userId: member.id } }) === 4 && await prisma.accessGrant.count({ where: { email: member.email, status: 'ACTIVE' } }) === 4, 'Cancelamento não apaga histórico nem períodos pagos');
access = await resolvePremiumAccess(member.id);
check(access.hasAccess === true, 'Acesso mantido até o fim do período pago após cancelar a renovação');

// 8) Estorno revoga somente a cobrança estornada.
await hook(paymentEvent('PAYMENT_REFUNDED', { id: pay4, value: 77.0, ref: memberOrder.externalReference, subscription: SUB, customer: CUS, status: 'REFUNDED' }));
check((await prisma.accessGrant.findFirst({ where: { externalPaymentId: pay4 } })).status === 'CANCELED' && (await prisma.accessGrant.findFirst({ where: { externalPaymentId: pay1 } })).status === 'ACTIVE', 'PAYMENT_REFUNDED revoga só o grant estornado');

// =============================================================================
// 8) RECUSAS — cartão recusado / antifraude / cancelamento antes de pagar
// =============================================================================
for (const event of ['PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED']) {
  const email = `${event.toLowerCase()}@audit.invalid`.replaceAll('_', '-');
  const u = await prisma.user.create({ data: { email, firstAccessCompleted: true } });
  const rr = await postCheckout({ planSlug: 'mensal', ...buyer(email) });
  const o = await orderFromUrl(rr.data.checkout.checkoutUrl);
  const pid = newPayId();
  const resp = await hook(paymentEvent(event, { id: pid, value: 45.9, ref: o.externalReference, status: 'PENDING' }));
  check(resp.status === 200, `${event} reconhecido (200, não pausa a fila)`, String(resp.status));
  check((await orderByRef(o.externalReference)).status === 'FAILED' && await prisma.accessGrant.count({ where: { email } }) === 0, `${event}: ordem FAILED e nenhum acesso`);
  check((await resolvePremiumAccess(u.id)).hasAccess === false, `${event}: premium bloqueado`);
  const retry = await postCheckout({ planSlug: 'mensal', ...buyer(email) });
  check(retry.status === 200 && retry.data.checkout.checkoutUrl !== rr.data.checkout.checkoutUrl, `${event}: novo clique gera checkout novo (a ordem recusada não é reaproveitada)`);
  // O comprador tenta outro cartão na MESMA página e paga: a ordem recusada ainda aceita a confirmação.
  if (event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
    await hook(paymentEvent('PAYMENT_CONFIRMED', { id: newPayId(), value: 45.9, ref: o.externalReference }));
    check((await orderByRef(o.externalReference)).status === 'PAID' && (await resolvePremiumAccess(u.id)).hasAccess === true, 'Confirmação posterior na mesma ordem libera o acesso');
  }
}
const delRes = await postCheckout({ planSlug: 'semanal', ...buyer('removido@audit.invalid') });
const delOrder = await orderFromUrl(delRes.data.checkout.checkoutUrl);
const delPay = newPayId();
await hook(paymentEvent('PAYMENT_DELETED', { id: delPay, value: 11.9, ref: delOrder.externalReference, status: 'PENDING' }));
check((await orderByRef(delOrder.externalReference)).status === 'CANCELED', 'PAYMENT_DELETED antes do pagamento → ordem CANCELED');
await hook(paymentEvent('PAYMENT_OVERDUE', { id: newPayId(), value: 11.9, ref: delOrder.externalReference, status: 'OVERDUE', billingType: 'PIX' }));
check(await prisma.accessGrant.count({ where: { email: 'removido@audit.invalid' } }) === 0, 'Cobrança vencida/removida nunca libera acesso');

// Estorno total do semanal anônimo → premium revogado.
await hook(paymentEvent('PAYMENT_REFUNDED', { id: semPay, value: 11.9, ref: semOrder.externalReference, billingType: 'PIX', status: 'REFUNDED' }));
access = await resolvePremiumAccess(anonUser.id);
check((await orderByRef(semOrder.externalReference)).status === 'REFUNDED' && access.hasAccess === false && access.reason === 'CANCELED', 'Estorno do semanal revoga o premium', JSON.stringify(access));
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: semPay, value: 11.9, ref: semOrder.externalReference, billingType: 'PIX' }));
check((await resolvePremiumAccess(anonUser.id)).hasAccess === false, 'Confirmação atrasada após estorno não restaura acesso');

// MAJOR (revisão): anônimo com o e-mail de um User verificado e os PRÓPRIOS dados
// não pode gravar o customer dele na conta da vítima.
const victim = await prisma.user.create({ data: { email: 'vitima@audit.invalid', emailVerified: new Date(), firstAccessCompleted: true } });
const atk = await postCheckout({ planSlug: 'semanal', ...buyer(victim.email, { cpfCnpj: '111.444.777-35', phone: '(21) 99876-5432', name: 'Atacante' }) });
const atkOrder = await orderFromUrl(atk.data.checkout.checkoutUrl);
check(atkOrder.userId === victim.id && atkOrder.externalReference.startsWith('instacessor:checkout:vitima@'), 'Checkout anônimo com e-mail de User não recebe marcador de sessão');
await hook(paymentEvent('PAYMENT_RECEIVED', { id: newPayId(), value: atkOrder.expectedAmountCents / 100, ref: atkOrder.externalReference, billingType: 'PIX', customer: 'cus_000009999001' }));
check((await orderByRef(atkOrder.externalReference)).status === 'PAID', 'Pagamento do checkout anônimo processado');
check((await prisma.user.findUnique({ where: { id: victim.id } })).asaasCustomerId === null, 'Customer do comprador anônimo NUNCA é vinculado à conta da vítima');
res = await startPublicCheckout({ email: victim.email, name: null, planId: 'plan:mensal', userId: victim.id, reuseStoredCustomer: true });
call = checkoutCalls().at(-1);
check(res.ok && !call.body.customer && call.body.customerData?.email === victim.email, 'Checkout posterior da vítima logada não reutiliza customer alheio');

// Checkout hospedado expirado/cancelado deixa de ser reaproveitado.
const expRes = await postCheckout({ planSlug: 'semanal', ...buyer('expirou@audit.invalid') });
const expOrder = await orderFromUrl(expRes.data.checkout.checkoutUrl);
const again = await postCheckout({ planSlug: 'semanal', ...buyer('expirou@audit.invalid') });
check(again.data.checkout.checkoutUrl === expRes.data.checkout.checkoutUrl, 'Antes de expirar: clique repetido reaproveita o checkout');
w = await hook({ id: `evt_chk_expired_${expOrder.externalCheckoutId}`, event: 'CHECKOUT_EXPIRED', dateCreated: `${today} 12:00:00`, checkout: { id: expOrder.externalCheckoutId, status: 'EXPIRED', externalReference: expOrder.externalReference } });
check(w.status === 200 && (await orderByRef(expOrder.externalReference)).status === 'EXPIRED', 'CHECKOUT_EXPIRED marca a ordem PENDING como EXPIRED');
const fresh = await postCheckout({ planSlug: 'semanal', ...buyer('expirou@audit.invalid') });
check(fresh.status === 200 && fresh.data.checkout.checkoutUrl !== expRes.data.checkout.checkoutUrl, 'Após expirar: novo clique gera checkout novo');
const canRes = await postCheckout({ planSlug: 'mensal', ...buyer('cancelou@audit.invalid') });
const canOrder = await orderFromUrl(canRes.data.checkout.checkoutUrl);
await hook({ id: `evt_chk_canceled_${canOrder.externalCheckoutId}`, event: 'CHECKOUT_CANCELED', dateCreated: `${today} 12:00:00`, checkout: { id: canOrder.externalCheckoutId, status: 'CANCELED', externalReference: canOrder.externalReference } });
check((await orderByRef(canOrder.externalReference)).status === 'CANCELED', 'CHECKOUT_CANCELED marca a ordem PENDING como CANCELED');
await hook({ id: `evt_chk_expired_paid_${expOrder.id}`, event: 'CHECKOUT_EXPIRED', checkout: { id: 'chk_paid', externalReference: atkOrder.externalReference } });
check((await orderByRef(atkOrder.externalReference)).status === 'PAID', 'CHECKOUT_EXPIRED não altera ordem já paga');

// Recebimento em dinheiro desfeito revoga o acesso daquela cobrança.
const cashRes = await postCheckout({ planSlug: 'semanal', ...buyer('dinheiro@audit.invalid') });
const cashOrder = await orderFromUrl(cashRes.data.checkout.checkoutUrl);
const cashPay = newPayId();
await hook(paymentEvent('PAYMENT_RECEIVED', { id: cashPay, value: cashOrder.expectedAmountCents / 100, ref: cashOrder.externalReference, billingType: 'PIX' }));
check((await prisma.accessGrant.findFirst({ where: { externalPaymentId: cashPay } })).status === 'PENDING_FIRST_ACCESS', 'Recebimento libera o grant');
await hook(paymentEvent('PAYMENT_RECEIVED_IN_CASH_UNDONE', { id: cashPay, value: cashOrder.expectedAmountCents / 100, ref: cashOrder.externalReference, billingType: 'PIX', status: 'PENDING' }));
check((await prisma.accessGrant.findFirst({ where: { externalPaymentId: cashPay } })).status === 'CANCELED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE revoga o grant da cobrança');
await hook(paymentEvent('PAYMENT_CONFIRMED', { id: cashPay, value: cashOrder.expectedAmountCents / 100, ref: cashOrder.externalReference, billingType: 'PIX' }));
check((await prisma.accessGrant.findFirst({ where: { externalPaymentId: cashPay } })).status === 'CANCELED', 'Confirmação tardia após recebimento desfeito não restaura acesso');

// Recusa nunca sobrescreve ordem estornada.
await hook(paymentEvent('PAYMENT_REPROVED_BY_RISK_ANALYSIS', { id: newPayId(), value: 11.9, ref: semOrder.externalReference, status: 'PENDING' }));
check((await orderByRef(semOrder.externalReference)).status === 'REFUNDED', 'Recusa posterior não sobrescreve ordem REFUNDED');

const offTarget = calls.filter((c) => !c.path.startsWith('/'));
check(offTarget.length === 0, 'Todas as chamadas foram para o simulador Sandbox');
await prisma.$disconnect();
console.log(`${checks} Asaas sandbox-flow assertions passed (simulated API; ${calls.length} simulated Asaas calls; no real network).`);
