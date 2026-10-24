// Transactional launch email worker: local embedded PostgreSQL + mocked Resend only.
// Usage (unprivileged user): node bench/test-launch-email-worker.mjs
// The parent creates a disposable cluster, applies the reviewed migrations and re-runs
// this file with --child and a sanitized environment. No real provider or database.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const LAUNCH_MIGRATION = '20261020190000_launch_waitlist';

if (!process.argv.includes('--child')) {
  const { LocalPostgres } = await import('./local-postgres.mjs');
  const { Client } = await import('pg');
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/neon-preview-migration-manifest.json'), 'utf8'));
  const migrations = manifest.migrations.map(entry => {
    const sql = readFileSync(resolve(root, 'prisma/migrations', entry.migration, 'migration.sql'), 'utf8');
    assert.equal(createHash('sha256').update(sql).digest('hex').toUpperCase(), entry.sha256.toUpperCase(), `Historical SQL changed: ${entry.migration}`);
    return sql;
  });
  if (!manifest.migrations.some(entry => entry.migration === LAUNCH_MIGRATION)) {
    migrations.push(readFileSync(resolve(root, 'prisma/migrations', LAUNCH_MIGRATION, 'migration.sql'), 'utf8'));
  }
  const env = {};
  for (const key of ['PATH', 'TEMP', 'TMP', 'HOME']) if (process.env[key]) env[key] = process.env[key];
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  const port = await new Promise((done, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => done(value)); });
  });
  const folder = resolve(root, `outputs/launch-email-worker-postgres-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const postgres = new LocalPostgres(folder, port);
  const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
  Object.assign(env, {
    DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port),
    NODE_ENV: 'test', TOKEN_ENCRYPTION_KEY: 'synthetic-launch-email-worker-encryption-key-only',
    NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs')}"`,
  });
  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
    const client = new Client({ connectionString: url }); await client.connect();
    try { for (const sql of migrations) await client.query(sql); } finally { await client.end(); }
    const child = spawn(process.execPath, ['--import', './bench/register-ts-alias.mjs', 'bench/test-launch-email-worker.mjs', '--child'], { cwd: root, env, windowsHide: true });
    let output = '';
    child.stdout.on('data', data => { output += data; process.stdout.write(data); });
    child.stderr.on('data', data => { output += data; process.stderr.write(data); });
    const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
    writeFileSync(resolve(folder, 'assertions.log'), output);
    assert.equal(exit, 0, 'child assertions failed');
    assert.match(output, /\d+ launch email worker assertions passed/);
  } finally { await postgres.stop(); }
  process.exit(0);
}

// ---------- child: everything below talks only to the disposable cluster ----------
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
assert.equal(target.pathname, '/inst_acessor_audit');
assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
assert.ok(!process.env.SITE_URL && !process.env.AUTH_URL, 'Official origin must not be overridden');

let checks = 0;
function check(condition, name) { assert.ok(condition, name); checks++; console.log(`ok ${name}`); }

/** Mocked Resend. Behaviour per recipient; every call is recorded. */
const calls = [];
const behaviour = new Map();
let delayMs = 0;
let sequence = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url !== 'https://api.resend.com/emails') throw new Error(`Unexpected outbound request in test: ${url}`);
  const body = JSON.parse(init.body);
  const headers = new Headers(init.headers);
  calls.push({ to: body.to[0], body, idempotencyKey: headers.get('idempotency-key'), authorization: headers.get('authorization'), redirect: init.redirect });
  if (delayMs) await new Promise(done => setTimeout(done, delayMs));
  const mode = behaviour.get(body.to[0]) ?? 'ok';
  if (mode === 'timeout') { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
  if (mode === 'network') throw new TypeError('fetch failed');
  if (typeof mode === 'number') return new Response(JSON.stringify({ name: 'synthetic' }), { status: mode, headers: { 'content-type': 'application/json' } });
  if (mode === 'no-id') return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ id: `re_synthetic_${++sequence}` }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const callsTo = email => calls.filter(call => call.to === email);
const configure = () => Object.assign(process.env, { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_synthetic_key_not_real', EMAIL_FROM: 'Inst Acessor <launch@audit.invalid>' });
const unconfigure = () => { delete process.env.EMAIL_PROVIDER; delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; };

const { prisma } = await import('../src/lib/db.ts');
const { decryptToken } = await import('../src/lib/crypto.ts');
const { registerLaunchSubscriber, confirmLaunchSubscription, unsubscribeLaunchSubscriber, prepareLaunchCampaign } = await import('../src/lib/launch-waitlist/service.ts');
const { processLaunchEmails } = await import('../src/lib/launch-waitlist/email-worker.ts');
const route = await import('../src/app/api/cron/launch-emails/route.ts');

const suffix = randomBytes(4).toString('hex');
let counter = 0;
const signup = (patch = {}) => {
  const index = ++counter;
  return { name: `Pessoa Sintetica ${index}`, email: `worker-${suffix}-${index}@audit.invalid`, whatsapp: `+55117777${String(index).padStart(5, '0')}`,
    planSlug: 'mensal', emailConsent: true, whatsappConsent: false, source: 'landing-plan', website: '', ...patch };
};
const subscriberOf = data => prisma.launchSubscriber.findUniqueOrThrow({ where: { email: data.email } });
const notification = (subscriberId, kind, channel = 'EMAIL') => prisma.launchNotification.findFirstOrThrow({ where: { subscriberId, kind, channel, campaignId: null }, orderBy: { createdAt: 'desc' } });
const secretsOf = async subscriberId => JSON.parse(decryptToken((await notification(subscriberId, 'VERIFY')).privatePayload));
const register = async (patch) => { const data = signup(patch); await registerLaunchSubscriber(data); const row = await subscriberOf(data); return { data, row, secrets: await secretsOf(row.id) }; };

try {
  // 1. Not configured: nothing happens, rows stay HELD.
  unconfigure();
  const a = await register();
  const idle = await processLaunchEmails();
  check(!idle.configured && idle.promoted === 0 && idle.claimed === 0, 'Worker reports not configured and promotes nothing');
  check(calls.length === 0, 'No provider request without configuration');
  check((await notification(a.row.id, 'VERIFY')).status === 'HELD', 'Verification stays HELD while provider is not configured');
  process.env.EMAIL_PROVIDER = 'resend'; process.env.RESEND_API_KEY = 're_synthetic_key_not_real';
  await processLaunchEmails();
  check(calls.length === 0 && (await notification(a.row.id, 'VERIFY')).status === 'HELD', 'Missing explicit EMAIL_FROM is treated as not configured');

  // 2. VERIFY delivered once with official links and idempotency key.
  configure();
  const verifyRow = await notification(a.row.id, 'VERIFY');
  const first = await processLaunchEmails();
  check(first.configured && first.sent >= 1, 'Configured worker sends pending verification');
  const verifyCalls = callsTo(a.data.email);
  check(verifyCalls.length === 1, 'Verification sent exactly once');
  const sentVerify = verifyCalls[0];
  check(sentVerify.idempotencyKey === verifyRow.idempotencyKey, 'Resend Idempotency-Key equals the notification idempotency key');
  check(sentVerify.authorization === 'Bearer re_synthetic_key_not_real' && sentVerify.redirect === 'error', 'Authenticated request refuses redirects');
  check(sentVerify.body.from === 'Inst Acessor <launch@audit.invalid>' && sentVerify.body.to.length === 1, 'Explicit sender and single recipient');
  const confirmUrl = `https://unitrixapp.com.br/lista-de-espera/confirmar#token=${a.secrets.token}`;
  const cancelUrl = `https://unitrixapp.com.br/lista-de-espera/cancelar#token=${a.secrets.unsubscribeToken}`;
  check(sentVerify.body.text.includes(confirmUrl) && sentVerify.body.html.includes(confirmUrl), 'Confirmation link uses the official origin');
  check(sentVerify.body.text.includes(cancelUrl), 'Verification includes the unsubscribe link on the official origin');
  const sentRow = await prisma.launchNotification.findUniqueOrThrow({ where: { id: verifyRow.id } });
  check(sentRow.status === 'SENT' && sentRow.providerId?.startsWith('re_synthetic_') && sentRow.privatePayload === null && sentRow.sentAt, 'Row finished SENT with provider id and payload erased');
  await processLaunchEmails();
  check(callsTo(a.data.email).length === 1, 'Second run does not resend verification');
  const firstJson = JSON.stringify(first);
  check(!firstJson.includes('@') && !firstJson.includes(a.secrets.token), 'Worker result carries counts only');

  // 3. WELCOME after confirmation; no confirmation link.
  check(await confirmLaunchSubscription(a.secrets.token), 'Synthetic subscriber confirms');
  await processLaunchEmails();
  const welcomeCalls = callsTo(a.data.email).slice(1);
  check(welcomeCalls.length === 1, 'Welcome sent exactly once after confirmation');
  check(welcomeCalls[0].idempotencyKey === `welcome:${a.row.id}:EMAIL`, 'Welcome uses its own idempotency key');
  check(welcomeCalls[0].body.text.includes(cancelUrl) && !welcomeCalls[0].body.text.includes('/confirmar'), 'Welcome carries unsubscribe link and no confirmation link');
  check((await notification(a.row.id, 'WELCOME')).status === 'SENT', 'Welcome finished SENT');
  await processLaunchEmails();
  check(callsTo(a.data.email).length === 2, 'Welcome not resent');

  // 4. LAUNCH campaigns and WHATSAPP never sent, even if a row was set READY.
  const b = await register({ whatsappConsent: true });
  await confirmLaunchSubscription(b.secrets.token);
  const emailCampaign = await prepareLaunchCampaign({ key: `worker-${suffix}`, channel: 'EMAIL' });
  const phoneCampaign = await prepareLaunchCampaign({ key: `worker-phone-${suffix}`, channel: 'WHATSAPP' });
  const readyLaunch = await prisma.launchNotification.findFirstOrThrow({ where: { campaignId: emailCampaign.campaignId, subscriberId: b.row.id } });
  await prisma.launchNotification.update({ where: { id: readyLaunch.id }, data: { status: 'READY' } }); // fixture only
  const whatsappWelcome = await notification(b.row.id, 'WELCOME', 'WHATSAPP');
  await prisma.launchNotification.update({ where: { id: whatsappWelcome.id }, data: { status: 'READY' } }); // fixture only
  const callsBefore = calls.length;
  await processLaunchEmails(); await processLaunchEmails();
  const newCalls = calls.slice(callsBefore);
  check(newCalls.length === 1 && newCalls[0].to === b.data.email && newCalls[0].idempotencyKey === `welcome:${b.row.id}:EMAIL`, 'Only the email welcome is sent; no campaign message');
  check((await prisma.launchNotification.findUniqueOrThrow({ where: { id: readyLaunch.id } })).status === 'READY', 'READY LAUNCH row is never claimed by the worker');
  check(await prisma.launchNotification.count({ where: { campaignId: { in: [emailCampaign.campaignId, phoneCampaign.campaignId] }, status: { notIn: ['HELD', 'READY'] } } }) === 0, 'Campaign rows untouched');
  check((await prisma.launchNotification.findUniqueOrThrow({ where: { id: whatsappWelcome.id } })).status === 'READY', 'WhatsApp welcome is never claimed');
  check(calls.every(call => !call.idempotencyKey.startsWith('campaign:')), 'No campaign idempotency key ever reached the provider');

  // 5. Unsubscribed subscribers: pending messages not sent.
  const c = await register();
  await unsubscribeLaunchSubscriber(c.secrets.unsubscribeToken);
  const d = await register();
  await prisma.launchSubscriber.update({ where: { id: d.row.id }, data: { status: 'UNSUBSCRIBED', emailConsent: false } }); // race fixture: row still HELD
  const e = await register();
  await confirmLaunchSubscription(e.secrets.token);
  await prisma.launchSubscriber.update({ where: { id: e.row.id }, data: { status: 'UNSUBSCRIBED', emailConsent: false } }); // welcome still HELD
  await processLaunchEmails();
  check(callsTo(c.data.email).length === 0 && callsTo(d.data.email).length === 0 && callsTo(e.data.email).length === 0, 'Unsubscribed subscribers receive nothing');
  check((await notification(d.row.id, 'VERIFY')).status === 'HELD' && (await notification(e.row.id, 'WELCOME')).status === 'HELD', 'Ineligible rows are not promoted');
  const f = await register();
  await prisma.launchSubscriber.update({ where: { id: f.row.id }, data: { verificationExpiresAt: new Date(Date.now() - 1000) } });
  await processLaunchEmails();
  check(callsTo(f.data.email).length === 0, 'Expired verification is not sent');

  // 6. Timeout / unknown responses → UNCERTAIN, never resent.
  const timeout = await register(); behaviour.set(timeout.data.email, 'timeout');
  const server = await register(); behaviour.set(server.data.email, 502);
  const noId = await register(); behaviour.set(noId.data.email, 'no-id');
  const network = await register(); behaviour.set(network.data.email, 'network');
  const uncertainRun = await processLaunchEmails();
  check(uncertainRun.uncertain === 4, 'Timeout, 5xx, missing provider id and network failure counted uncertain');
  for (const [person, code] of [[timeout, 'PROVIDER_TIMEOUT'], [server, 'PROVIDER_HTTP_STATUS'], [noId, 'PROVIDER_INVALID_RESPONSE'], [network, 'PROVIDER_NETWORK']]) {
    const row = await notification(person.row.id, 'VERIFY');
    check(row.status === 'UNCERTAIN' && row.errorCode === code && row.leaseToken === null, `Ambiguous outcome ${code} recorded as UNCERTAIN`);
    behaviour.delete(person.data.email);
  }
  await processLaunchEmails(); await processLaunchEmails();
  check([timeout, server, noId, network].every(person => callsTo(person.data.email).length === 1), 'Uncertain messages are never resent automatically');

  // 7. Definite refusal → HELD again (nothing sent), bounded attempts; systemic refusal stops the batch.
  const rejected = await register(); behaviour.set(rejected.data.email, 422);
  await processLaunchEmails();
  let rejectedRow = await notification(rejected.row.id, 'VERIFY');
  check(rejectedRow.status === 'HELD' && rejectedRow.errorCode === 'PROVIDER_REJECTED_422' && rejectedRow.privatePayload, 'Documented refusal returns row to HELD with payload intact');
  behaviour.delete(rejected.data.email);
  await processLaunchEmails();
  rejectedRow = await notification(rejected.row.id, 'VERIFY');
  check(rejectedRow.status === 'SENT' && callsTo(rejected.data.email).length === 2, 'Refused message is delivered on a later run');
  const capped = await register(); behaviour.set(capped.data.email, 400);
  for (let run = 0; run < 5; run++) await processLaunchEmails();
  check(callsTo(capped.data.email).length === 3 && (await notification(capped.row.id, 'VERIFY')).status === 'HELD', 'Refusals stop after the attempt cap');
  behaviour.delete(capped.data.email);
  const limited = [await register(), await register()];
  for (const person of limited) behaviour.set(person.data.email, 429);
  const before429 = calls.length;
  const limitedRun = await processLaunchEmails();
  check(calls.length - before429 === 1 && limitedRun.released === 1, 'Rate limit stops the batch after one request');
  check((await Promise.all(limited.map(person => notification(person.row.id, 'VERIFY')))).every(row => row.status === 'HELD'), 'Rows left unclaimed by a stopped batch return to HELD');
  for (const person of limited) behaviour.delete(person.data.email);
  await processLaunchEmails();
  check(limited.every(person => calls.filter(call => call.to === person.data.email).length >= 1) &&
    (await Promise.all(limited.map(person => notification(person.row.id, 'VERIFY')))).every(row => row.status === 'SENT'), 'Rate-limited messages delivered once quota returns');

  // 8. Concurrent workers send exactly once.
  const crowd = [];
  for (let i = 0; i < 8; i++) crowd.push(await register());
  delayMs = 30;
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => processLaunchEmails()));
  delayMs = 0;
  check(crowd.every(person => callsTo(person.data.email).length === 1), 'Concurrent workers deliver each verification exactly once');
  check(concurrent.reduce((sum, run) => sum + run.sent, 0) === 8, 'Exactly one worker records each send');
  await processLaunchEmails();
  check(crowd.every(person => callsTo(person.data.email).length === 1), 'Nothing resent after concurrent runs');
  const idempotencyKeys = calls.map(call => call.idempotencyKey);
  check(new Set(idempotencyKeys).size === idempotencyKeys.length - 4, 'Only explicitly refused requests reused an idempotency key');

  // 9. Expired lease recovered as UNCERTAIN at start of run.
  const stuck = await register();
  const stuckRow = await notification(stuck.row.id, 'VERIFY');
  await prisma.launchNotification.update({ where: { id: stuckRow.id }, data: { status: 'PROCESSING', leaseToken: 'synthetic-lease', leaseUntil: new Date(Date.now() - 1000) } });
  const recoveredRun = await processLaunchEmails();
  check(recoveredRun.recovered === 1 && (await notification(stuck.row.id, 'VERIFY')).status === 'UNCERTAIN' && callsTo(stuck.data.email).length === 0, 'Expired claim becomes UNCERTAIN without sending');

  // 10. Route authentication, feature flag and response shape.
  const request = (authorization, method = 'GET') => new Request('http://127.0.0.1/api/cron/launch-emails', { method, headers: authorization ? { authorization } : {} });
  delete process.env.CRON_SECRET; delete process.env.LAUNCH_EMAIL_WORKER_ENABLED;
  check((await route.GET(request('Bearer anything'))).status === 503, 'Route unavailable without CRON_SECRET');
  process.env.CRON_SECRET = 'synthetic-cron-secret-value';
  const pending = await register();
  check((await route.GET(request())).status === 401, 'Missing authorization rejected');
  check((await route.GET(request('Bearer wrong-secret'))).status === 401, 'Wrong secret rejected');
  check((await route.POST(request('Bearer synthetic-cron-secret-value-x', 'POST'))).status === 401, 'Longer wrong secret rejected on POST');
  const disabled = await route.GET(request('Bearer synthetic-cron-secret-value'));
  check(disabled.status === 503 && (await disabled.json()).enabled === false, 'Disabled flag returns 503');
  process.env.LAUNCH_EMAIL_WORKER_ENABLED = '1';
  check((await route.GET(request('Bearer synthetic-cron-secret-value'))).status === 503, 'Only the literal "true" enables the worker');
  check(callsTo(pending.data.email).length === 0 && (await notification(pending.row.id, 'VERIFY')).status === 'HELD', 'Rejected or disabled calls send nothing');
  process.env.LAUNCH_EMAIL_WORKER_ENABLED = 'true';
  const enabled = await route.POST(request('Bearer synthetic-cron-secret-value', 'POST'));
  const enabledText = await enabled.text();
  check(enabled.status === 200 && enabled.headers.get('cache-control') === 'no-store', 'Enabled route answers no-store');
  check(JSON.parse(enabledText).sent === 1 && !enabledText.includes('@') && !enabledText.includes(pending.secrets.token), 'Route returns counts only');
  check(callsTo(pending.data.email).length === 1, 'Route delivered the pending verification once');
  check(route.runtime === 'nodejs' && route.dynamic === 'force-dynamic', 'Route is dynamic on the Node.js runtime');

  console.log(`${checks} launch email worker assertions passed; Resend mocked, no real transport`);
} finally {
  await prisma.$disconnect();
}
