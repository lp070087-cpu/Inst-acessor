// Launch campaigns (NEWS/LAUNCH), WhatsApp Cloud API transport and preferences.
// Local embedded PostgreSQL + mocked Resend + mocked graph.facebook.com only.
// Usage (unprivileged user): node bench/test-launch-campaigns.mjs
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
  const folder = resolve(root, `outputs/launch-campaigns-postgres-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const postgres = new LocalPostgres(folder, port);
  const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
  Object.assign(env, {
    DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port),
    NODE_ENV: 'test', TOKEN_ENCRYPTION_KEY: 'synthetic-launch-campaigns-encryption-key-only',
    NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs')}"`,
  });
  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
    const client = new Client({ connectionString: url }); await client.connect();
    try { for (const sql of migrations) await client.query(sql); } finally { await client.end(); }
    const child = spawn(process.execPath, ['--import', './bench/register-ts-alias.mjs', 'bench/test-launch-campaigns.mjs', '--child'], { cwd: root, env, windowsHide: true });
    let output = '';
    child.stdout.on('data', data => { output += data; process.stdout.write(data); });
    child.stderr.on('data', data => { output += data; process.stderr.write(data); });
    const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
    writeFileSync(resolve(folder, 'assertions.log'), output);
    assert.equal(exit, 0, 'child assertions failed');
    assert.match(output, /\d+ launch campaign assertions passed/);
  } finally { await postgres.stop(); }
  process.exit(0);
}

// ---------- child: everything below talks only to the disposable cluster ----------
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
assert.equal(target.pathname, '/inst_acessor_audit');
assert.ok(!process.env.SITE_URL && !process.env.AUTH_URL, 'Official origin must not be overridden');

let checks = 0;
function check(condition, name) { assert.ok(condition, name); checks++; console.log(`ok ${name}`); }
async function rejectsWith(promise, code, name) { await assert.rejects(promise, error => error.code === code || error.message === code); checks++; console.log(`ok ${name}`); }

/** Mocked Resend + Graph API. Behaviour keyed by recipient; every call recorded. */
const email = [], graph = [];
const emailBehaviour = new Map(), graphBehaviour = new Map();
let sequence = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
  const body = JSON.parse(init.body);
  const headers = new Headers(init.headers);
  if (url === 'https://api.resend.com/emails') {
    email.push({ to: body.to[0], body, idempotencyKey: headers.get('idempotency-key') });
    const mode = emailBehaviour.get(body.to[0]) ?? 'ok';
    if (mode === 'timeout') { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
    if (typeof mode === 'number') return new Response('{}', { status: mode, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: `re_synthetic_${++sequence}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.startsWith('https://graph.facebook.com/')) {
    graph.push({ url, to: body.to, body, authorization: headers.get('authorization'), redirect: init.redirect });
    const mode = graphBehaviour.get(body.to) ?? 'ok';
    if (mode === 'timeout') { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
    if (typeof mode === 'number') return new Response(JSON.stringify({ error: { message: 'synthetic', type: 'OAuthException', code: mode, fbtrace_id: 'x' } }), { status: mode === 130429 ? 429 : 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ messaging_product: 'whatsapp', contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id: `wamid.HBgN${++sequence}AbC+/==` }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`Unexpected outbound request in test: ${url}`);
};
const emailsTo = address => email.filter(call => call.to === address);
const graphTo = e164 => graph.filter(call => call.to === e164.slice(1));
const configureEmail = () => Object.assign(process.env, { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_synthetic_key_not_real', EMAIL_FROM: 'Inst Acessor <launch@audit.invalid>', LAUNCH_EMAIL_WORKER_ENABLED: 'true' });
const WA_ENV = { WHATSAPP_WORKER_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'EAAsyntheticwhatsapptokennotreal000', WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_GRAPH_VERSION: 'v23.0', WHATSAPP_TEMPLATE_LAUNCH: 'abertura_planos', WHATSAPP_TEMPLATE_NEWS: 'novidades_app', WHATSAPP_TEMPLATE_LANG: 'pt_BR', WHATSAPP_TEMPLATE_NAME_PARAM: 'true' };

const { prisma } = await import('../src/lib/db.ts');
const { decryptToken } = await import('../src/lib/crypto.ts');
const { registerLaunchSubscriber, confirmLaunchSubscription, unsubscribeLaunchSubscriber, prepareLaunchCampaign } = await import('../src/lib/launch-waitlist/service.ts');
const { confirmLaunchCampaignSend, assertCampaignContent } = await import('../src/lib/launch-waitlist/campaigns.ts');
const { processLaunchCampaignMessages } = await import('../src/lib/launch-waitlist/campaign-worker.ts');
const { processLaunchEmails } = await import('../src/lib/launch-waitlist/email-worker.ts');
const { renderLaunchMessage } = await import('../src/lib/launch-waitlist/templates.ts');
const { launchCampaignPrepareSchema, launchCampaignSendSchema, launchPreferencesSchema } = await import('../src/lib/launch-waitlist/admin-validation.ts');
const { classifyWhatsAppError, isWhatsAppConfigured } = await import('../src/lib/whatsapp/cloud-api.ts');
const preferencesRoute = await import('../src/app/api/launch-waitlist/preferences/route.ts');
const cron = await import('../src/app/api/cron/launch-emails/route.ts');

const suffix = randomBytes(4).toString('hex');
let counter = 0;
const signup = (patch = {}) => {
  const index = ++counter;
  return { name: `Pessoa <b>Sintetica</b> ${index}`, email: `campaign-${suffix}-${index}@audit.invalid`, whatsapp: `+55116666${String(index).padStart(5, '0')}`,
    planSlug: 'anual', emailConsent: true, whatsappConsent: false, source: 'landing', website: '', privacyAccepted: true, ...patch };
};
const subscriberOf = data => prisma.launchSubscriber.findUniqueOrThrow({ where: { email: data.email } });
const secretsOf = async id => JSON.parse(decryptToken((await prisma.launchNotification.findFirstOrThrow({ where: { subscriberId: id, kind: 'VERIFY' }, orderBy: { createdAt: 'desc' } })).privatePayload));
const person = async (patch, confirm = true) => {
  const data = signup(patch); await registerLaunchSubscriber(data);
  const row = await subscriberOf(data); const secrets = await secretsOf(row.id);
  if (confirm) assert.ok(await confirmLaunchSubscription(secrets.token));
  return { data, row, secrets };
};
const rowOf = (campaignId, subscriberId) => prisma.launchNotification.findFirstOrThrow({ where: { campaignId, subscriberId } });
const campaignStatus = async id => (await prisma.launchCampaign.findUniqueOrThrow({ where: { id } })).status;
const OFFICIAL = 'https://unitrixapp.com.br';
const run = (channel, options = {}) => processLaunchCampaignMessages(channel, { intervalMs: 0, ...options });

try {
  // 1. Pure contracts: templates, admin schemas, WhatsApp error classification.
  const links = { unsubscribeUrl: `${OFFICIAL}/lista-de-espera/cancelar#token=x`, preferencesUrl: `${OFFICIAL}/lista-de-espera/preferencias#token=x` };
  const news = renderLaunchMessage({ kind: 'NEWS', name: 'Ana', planSlug: 'mensal', ...links, newsSubject: 'Novidade\r\nBcc: x', newsBody: 'Linha <script>alert(1)</script>\n\nSegunda & parte', newsCtaUrl: `${OFFICIAL}/blog` });
  check(news.subject === 'Novidade Bcc: x', 'NEWS subject is single-line (no header injection)');
  check(!news.html.includes('<script>') && news.html.includes('&lt;script&gt;') && news.html.includes('&amp; parte'), 'NEWS body escaped in HTML');
  check(news.text.includes(links.unsubscribeUrl) && news.text.includes(links.preferencesUrl) && news.html.includes('Gerenciar preferências'), 'NEWS footer carries unsubscribe and preferences links');
  assert.throws(() => renderLaunchMessage({ kind: 'NEWS', name: 'Ana', planSlug: 'mensal', ...links, newsSubject: 'ok', newsBody: 'x'.repeat(2001) }), /NEWS_CONTENT_INVALID/); checks++;
  assert.throws(() => renderLaunchMessage({ kind: 'NEWS', name: 'Ana', planSlug: 'mensal', ...links, newsSubject: 'Assunto', newsBody: 'Corpo suficiente', newsCtaUrl: 'https://evil.audit.invalid/' }), /CAMPAIGN_ORIGIN_MISMATCH/); checks++;
  assert.throws(() => renderLaunchMessage({ kind: 'NEWS', name: 'Ana', planSlug: 'mensal', unsubscribeUrl: 'javascript:alert(1)', newsSubject: 'Assunto', newsBody: 'Corpo suficiente' }), /INVALID_CAMPAIGN_LINK/); checks++;
  check(!launchCampaignPrepareSchema.safeParse({ key: 'news-1', channel: 'EMAIL', kind: 'NEWS', confirmQueue: true }).success, 'Email NEWS requires subject and body');
  check(!launchCampaignPrepareSchema.safeParse({ key: 'news-1', channel: 'EMAIL', kind: 'NEWS', confirmQueue: true, subject: 'Oi', body: 'x'.repeat(2001) }).success, 'NEWS length limits enforced');
  check(launchCampaignPrepareSchema.safeParse({ key: 'news-1', channel: 'WHATSAPP', kind: 'NEWS', confirmQueue: true }).success, 'WhatsApp NEWS uses the approved template text');
  check(!launchCampaignPrepareSchema.safeParse({ key: 'launch-1', channel: 'EMAIL', kind: 'LAUNCH', confirmQueue: true }).success, 'LAUNCH requires saleUrl');
  check(!launchCampaignPrepareSchema.safeParse({ key: 'launch-1', channel: 'EMAIL', confirmQueue: true, saleUrl: 'javascript:alert(1)' }).success, 'Non-https sale URL refused');
  check(!launchCampaignPrepareSchema.safeParse({ key: 'launch-1', channel: 'EMAIL', kind: 'NEWS', subject: 'Assunto', body: 'Corpo suficiente' }).success, 'Preparation still requires confirmQueue');
  check(!launchCampaignSendSchema.safeParse({ key: 'news-1', confirmKey: 'news-2', confirmSend: true }).success, 'Send requires the exact key retyped');
  check(!launchCampaignSendSchema.safeParse({ key: 'news-1', confirmKey: 'news-1' }).success, 'Send requires confirmSend=true');
  check(!launchPreferencesSchema.safeParse({ action: 'update', token: 'a'.repeat(64), emailConsent: true }).success, 'Preferences update needs both channels');
  assert.throws(() => assertCampaignContent('EMAIL', 'LAUNCH', { saleUrl: 'https://other.audit.invalid/planos' }), error => error.code === 'URL_NOT_OFFICIAL'); checks++;
  check(classifyWhatsAppError(400, 131048).status === 'RATE_LIMITED' && classifyWhatsAppError(429, 130429).status === 'RATE_LIMITED', 'Spam/throughput limits classified as rate limit');
  check(classifyWhatsAppError(404, 132001).status === 'TEMPLATE_ERROR' && classifyWhatsAppError(400, 131026).status === 'RECIPIENT_ERROR', 'Template and recipient errors classified');
  check(classifyWhatsAppError(500, 131000).status === 'UNCERTAIN' && classifyWhatsAppError(401, 190).status === 'REJECTED', 'Server errors uncertain; auth errors rejected');
  check(!isWhatsAppConfigured(), 'WhatsApp not configured by default');
  process.env.WHATSAPP_ACCESS_TOKEN = WA_ENV.WHATSAPP_ACCESS_TOKEN; process.env.WHATSAPP_PHONE_NUMBER_ID = WA_ENV.WHATSAPP_PHONE_NUMBER_ID;
  check(!isWhatsAppConfigured(), 'Credentials without WHATSAPP_WORKER_ENABLED="true" stay disabled');
  delete process.env.WHATSAPP_ACCESS_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 2. Subscribers.
  const both = await person({ whatsappConsent: true });
  const emailOnly = await person();
  const phoneOnly = await person({ emailConsent: false, whatsappConsent: true });
  const pending = await person({ whatsappConsent: true }, false);
  const leaving = await person({ whatsappConsent: true });
  const changing = await person({ whatsappConsent: true });

  // 3. NEWS email: prepare never sends; worker ignores PREPARED campaigns.
  configureEmail();
  await processLaunchEmails(); // flush transactional verify/welcome for a clean slate
  const baseline = email.length;
  const newsKey = `news-${suffix}`;
  const prepared = launchCampaignPrepareSchema.parse({ key: newsKey, channel: 'EMAIL', kind: 'NEWS', confirmQueue: true, subject: 'Novidades do app', body: 'Temos <novidades> & melhorias.\n\nObrigado!', ctaUrl: `${OFFICIAL}/novidades` });
  const newsCampaign = await prepareLaunchCampaign(prepared);
  const newsRows = await prisma.launchNotification.findMany({ where: { campaignId: newsCampaign.campaignId } });
  check(newsCampaign.queued === 4 && newsRows.every(row => row.status === 'HELD' && row.kind === 'NEWS'), 'NEWS snapshot: verified email-consented subscribers only, HELD');
  check(newsRows.every(row => row.privatePayload && !row.privatePayload.includes('novidades')), 'Campaign content stored encrypted');
  await rejectsWith(prepareLaunchCampaign({ key: newsKey, channel: 'EMAIL', kind: 'LAUNCH', content: { saleUrl: `${OFFICIAL}/planos` } }), 'CAMPAIGN_CONFLICT', 'Same key with another kind conflicts');
  const idle = await run('EMAIL');
  check(idle.configured && idle.campaigns === 0 && email.length === baseline, 'Prepared (unconfirmed) campaign is never sent');
  check(await prisma.launchNotification.count({ where: { campaignId: newsCampaign.campaignId, status: 'HELD' } }) === 4, 'Rows stay HELD before confirmation');

  // 4. Second confirmation gated by transport configuration.
  delete process.env.LAUNCH_EMAIL_WORKER_ENABLED;
  await rejectsWith(confirmLaunchCampaignSend({ key: newsKey }), 'TRANSPORT_NOT_CONFIGURED', 'Send refused while email worker disabled');
  check(await campaignStatus(newsCampaign.campaignId) === 'PREPARED', 'Refused confirmation leaves campaign PREPARED');
  configureEmail();
  await rejectsWith(confirmLaunchCampaignSend({ key: `missing-${suffix}` }), 'NOT_FOUND', 'Unknown campaign refused');
  // Consent changes after the snapshot.
  check(await unsubscribeLaunchSubscriber(leaving.secrets.unsubscribeToken), 'Fixture unsubscribes after snapshot');
  const sent = await confirmLaunchCampaignSend({ key: newsKey });
  check(sent.status === 'SENDING' && sent.eligible === 3, 'Typed confirmation moves campaign to SENDING');
  check((await confirmLaunchCampaignSend({ key: newsKey })).alreadyConfirmed, 'Repeated confirmation is idempotent');
  const prefResponse = await preferencesRoute.POST(new Request('http://127.0.0.1/api/launch-waitlist/preferences', { method: 'POST', body: JSON.stringify({ action: 'update', token: changing.secrets.unsubscribeToken, emailConsent: false, whatsappConsent: true }) }));
  const prefJson = await prefResponse.json();
  check(prefResponse.status === 200 && prefJson.preferences.emailConsent === false && prefJson.preferences.whatsappConsent === true, 'Preferences turn email off');
  check(!JSON.stringify(prefJson).includes('@') && !JSON.stringify(prefJson).includes('+55'), 'Preferences response carries no personal data');
  check((await rowOf(newsCampaign.campaignId, changing.row.id)).status === 'CANCELLED' && (await rowOf(newsCampaign.campaignId, changing.row.id)).errorCode === 'CONSENT_REVOKED', 'Revoked channel cancels pending campaign row');
  check(await prisma.launchConsent.count({ where: { subscriberId: changing.row.id, source: 'preferences', channel: 'EMAIL', granted: false } }) === 1, 'Preference change audited in LaunchConsent');

  // 5. Delivery: only eligible, once, with idempotency key and footer links.
  const delivered = await run('EMAIL');
  const newsCalls = email.slice(baseline);
  check(delivered.sent === 2 && newsCalls.length === 2, 'Only the two still-eligible subscribers receive NEWS');
  check(emailsTo(both.data.email).length >= 1 && emailsTo(emailOnly.data.email).length >= 1 && !newsCalls.some(call => [phoneOnly, pending, leaving, changing].some(p => p.data.email === call.to)), 'Unsubscribed, pending, WhatsApp-only and revoked receive nothing');
  const bothRow = await rowOf(newsCampaign.campaignId, both.row.id);
  const bothCall = newsCalls.find(call => call.to === both.data.email);
  check(bothCall.idempotencyKey === bothRow.idempotencyKey && bothRow.idempotencyKey.startsWith('campaign:'), 'Resend Idempotency-Key equals the campaign notification key');
  check(bothCall.body.subject === 'Novidades do app' && bothCall.body.html.includes('&lt;novidades&gt;') && !bothCall.body.html.includes('<novidades>'), 'Admin content escaped in email');
  check(bothCall.body.text.includes(`${OFFICIAL}/lista-de-espera/preferencias#token=${both.secrets.unsubscribeToken}`) && bothCall.body.text.includes(`${OFFICIAL}/lista-de-espera/cancelar#token=${both.secrets.unsubscribeToken}`), 'Footer has personal preferences and unsubscribe links');
  check(bothCall.body.text.includes(`${OFFICIAL}/novidades`), 'Optional same-origin CTA included');
  check(bothRow.status === 'SENT' && bothRow.privatePayload === null && bothRow.providerId, 'Row finished SENT, payload erased');
  check((await rowOf(newsCampaign.campaignId, leaving.row.id)).status === 'CANCELLED', 'Unsubscribed row cancelled');
  check(await campaignStatus(newsCampaign.campaignId) === 'COMPLETED', 'Campaign completes when nothing deliverable remains');
  await run('EMAIL');
  check(email.length === baseline + 2, 'No resend on later runs');
  check(!JSON.stringify(delivered).includes('@'), 'Worker result carries counts only');

  // 6. LAUNCH email: official origin, explicit presale approval, uncertain + rate limit handling.
  const extra = [await person(), await person(), await person()];
  await rejectsWith(Promise.resolve().then(() => assertCampaignContent('EMAIL', 'LAUNCH', { saleUrl: 'http://unitrixapp.com.br/planos' })), 'URL_NOT_OFFICIAL', 'http sale URL is not the official origin');
  const launchKey = `launch-${suffix}`;
  const launch = await prepareLaunchCampaign(launchCampaignPrepareSchema.parse({ key: launchKey, channel: 'EMAIL', confirmQueue: true, saleUrl: `${OFFICIAL}/planos` }));
  await rejectsWith(confirmLaunchCampaignSend({ key: launchKey }), 'PRESALE_APPROVAL_REQUIRED', 'LAUNCH send requires explicit presale approval');
  check(await campaignStatus(launch.campaignId) === 'PREPARED', 'Unapproved LAUNCH stays PREPARED');
  await confirmLaunchCampaignSend({ key: launchKey, presaleApproved: true });
  emailBehaviour.set(extra[0].data.email, 'timeout');
  emailBehaviour.set(extra[1].data.email, 429);
  const before = email.length;
  const launchRun = await run('EMAIL');
  check(launchRun.released === 1 && launchRun.stopped === 'PROVIDER_REJECTED_429', '429 stops the batch');
  const limitedRow = await rowOf(launch.campaignId, extra[1].row.id);
  check(limitedRow.status === 'HELD' && limitedRow.attempts === 0 && limitedRow.errorCode === 'PROVIDER_REJECTED_429', 'Rate-limited row back to HELD without consuming attempts');
  check(await prisma.launchNotification.count({ where: { campaignId: launch.campaignId, status: 'READY' } }) === 0, 'Unclaimed rows return to HELD after a stop');
  emailBehaviour.delete(extra[1].data.email);
  await run('EMAIL'); await run('EMAIL');
  const timeoutRow = await rowOf(launch.campaignId, extra[0].row.id);
  check(timeoutRow.status === 'UNCERTAIN' && timeoutRow.errorCode === 'PROVIDER_TIMEOUT', 'Timeout recorded UNCERTAIN');
  emailBehaviour.clear();
  await run('EMAIL');
  const launchCalls = email.slice(before).filter(call => call.idempotencyKey.startsWith(`campaign:${launch.campaignId}:`));
  check(launchCalls.filter(call => call.to === extra[0].data.email).length === 1, 'UNCERTAIN row never resent');
  check(launchCalls.some(call => call.to === extra[1].data.email && call.body.text.includes('está aberta') && call.body.text.includes(`${OFFICIAL}/planos`)), 'LAUNCH delivered with official sale link after quota returns');
  check(await campaignStatus(launch.campaignId) === 'COMPLETED', 'LAUNCH campaign completed');

  // 7. WhatsApp: never automatic, gated by configuration, template-only transport.
  const welcomeWa = await prisma.launchNotification.count({ where: { kind: 'WELCOME', channel: 'WHATSAPP', status: 'HELD' } });
  const waKey = `wa-${suffix}`;
  const waCampaign = await prepareLaunchCampaign(launchCampaignPrepareSchema.parse({ key: waKey, channel: 'WHATSAPP', confirmQueue: true, saleUrl: `${OFFICIAL}/planos` }));
  const waRows = await prisma.launchNotification.findMany({ where: { campaignId: waCampaign.campaignId } });
  check(waRows.length === 3 && !waRows.some(row => row.subscriberId === pending.row.id || row.subscriberId === leaving.row.id), 'WhatsApp snapshot: verified + whatsappConsent only');
  await rejectsWith(confirmLaunchCampaignSend({ key: waKey, presaleApproved: true }), 'TRANSPORT_NOT_CONFIGURED', 'WhatsApp send refused when not configured');
  const waIdle = await run('WHATSAPP');
  check(!waIdle.configured && graph.length === 0 && (await prisma.launchNotification.count({ where: { campaignId: waCampaign.campaignId, status: 'HELD' } })) === 3, 'Not configured: no Graph call, rows stay HELD');
  Object.assign(process.env, WA_ENV);
  await confirmLaunchCampaignSend({ key: waKey, presaleApproved: true });
  // A READY WhatsApp welcome (fixture) must never be claimed by the campaign worker.
  const welcomeRow = await prisma.launchNotification.findFirstOrThrow({ where: { subscriberId: phoneOnly.row.id, kind: 'WELCOME', channel: 'WHATSAPP' } });
  await prisma.launchNotification.update({ where: { id: welcomeRow.id }, data: { status: 'READY' } }); // fixture only
  graphBehaviour.set(changing.data.whatsapp.slice(1), 131048);
  graphBehaviour.set(both.data.whatsapp.slice(1), 132001);
  graphBehaviour.set(phoneOnly.data.whatsapp.slice(1), 131026);
  // Row order inside one snapshot is arbitrary: run until the rate-limited recipient was attempted.
  let waRun;
  for (let i = 0; i < 3 && graphTo(changing.data.whatsapp).length === 0; i++) waRun = await run('WHATSAPP');
  check(waRun.stopped === 'WA_RATE_LIMITED_131048' && waRun.released === 1, 'Spam rate limit (131048) stops the WhatsApp batch');
  const limitedWa = await rowOf(waCampaign.campaignId, changing.row.id);
  check(limitedWa.status === 'HELD' && limitedWa.attempts === 0 && limitedWa.errorCode === 'WA_RATE_LIMITED_131048', 'Rate-limited WhatsApp row back to HELD');
  graphBehaviour.delete(changing.data.whatsapp.slice(1));
  for (let i = 0; i < 4; i++) await run('WHATSAPP');
  const finalWa = await prisma.launchNotification.findMany({ where: { campaignId: waCampaign.campaignId } });
  const byPerson = Object.fromEntries(finalWa.map(row => [row.subscriberId, row]));
  check(byPerson[changing.row.id].status === 'SENT' && byPerson[changing.row.id].providerId.startsWith('wamid.') && byPerson[changing.row.id].providerId.includes('='), 'WhatsApp message id stored after quota returns');
  check(byPerson[both.row.id].status === 'CANCELLED' && byPerson[both.row.id].errorCode === 'WA_TEMPLATE_132001', 'Template error cancels the row with errorCode');
  check(byPerson[phoneOnly.row.id].status === 'CANCELLED' && byPerson[phoneOnly.row.id].errorCode === 'WA_RECIPIENT_131026', 'Recipient error cancels the row with errorCode');
  check(graphTo(both.data.whatsapp).length === 1 && graphTo(phoneOnly.data.whatsapp).length === 1, 'Cancelled WhatsApp rows are not retried');
  const sample = graph.find(call => call.to === changing.data.whatsapp.slice(1));
  check(sample.url === 'https://graph.facebook.com/v23.0/123456789012345/messages' && sample.authorization === `Bearer ${WA_ENV.WHATSAPP_ACCESS_TOKEN}` && sample.redirect === 'error', 'Official Cloud API endpoint with bearer token');
  check(sample.body.type === 'template' && sample.body.messaging_product === 'whatsapp' && sample.body.template.name === 'abertura_planos' && sample.body.template.language.code === 'pt_BR', 'Approved template + language from env');
  check(sample.body.template.components[0].parameters[0].text === 'Pessoa', 'Optional {{1}} first-name parameter');
  check(graph.every(call => !('text' in call.body)), 'No free-form WhatsApp text ever sent');
  check(graph.filter(call => call.to === changing.data.whatsapp.slice(1)).length === 2, 'Rate-limited message sent exactly once after retry');
  check((await prisma.launchNotification.findUniqueOrThrow({ where: { id: welcomeRow.id } })).status === 'READY' && welcomeWa >= 1, 'WhatsApp WELCOME never sent automatically');
  check(await campaignStatus(waCampaign.campaignId) === 'COMPLETED', 'WhatsApp campaign completed');

  // 8. WhatsApp timeout → UNCERTAIN; NEWS via template.
  const late = await person({ emailConsent: false, whatsappConsent: true });
  const waNewsKey = `wa-news-${suffix}`;
  const waNews = await prepareLaunchCampaign(launchCampaignPrepareSchema.parse({ key: waNewsKey, channel: 'WHATSAPP', kind: 'NEWS', confirmQueue: true }));
  await confirmLaunchCampaignSend({ key: waNewsKey });
  graphBehaviour.set(late.data.whatsapp.slice(1), 'timeout');
  await run('WHATSAPP'); await run('WHATSAPP');
  const lateRow = await rowOf(waNews.campaignId, late.row.id);
  check(lateRow.status === 'UNCERTAIN' && lateRow.errorCode === 'WA_TIMEOUT' && graphTo(late.data.whatsapp).length === 1, 'WhatsApp timeout UNCERTAIN, never retried');
  check(graph.some(call => call.body.template.name === 'novidades_app'), 'NEWS uses WHATSAPP_TEMPLATE_NEWS');
  graphBehaviour.clear();

  // 9. Preferences API: read, invalid token, cross-origin, unsubscribe.
  const prefs = (body, headers = {}) => preferencesRoute.POST(new Request('http://127.0.0.1/api/launch-waitlist/preferences', { method: 'POST', headers, body: JSON.stringify(body) }));
  const read = await prefs({ action: 'read', token: emailOnly.secrets.unsubscribeToken });
  const readJson = await read.json();
  check(read.status === 200 && readJson.preferences.status === 'VERIFIED' && readJson.preferences.emailConsent === true && Object.keys(readJson.preferences).length === 3, 'Read returns only status and consents');
  check((await prefs({ action: 'read', token: 'f'.repeat(64) })).status === 404, 'Unknown token gets generic 404');
  check((await prefs({ action: 'read', token: emailOnly.secrets.unsubscribeToken }, { origin: 'https://evil.audit.invalid' })).status === 403, 'Cross-origin request refused');
  check((await prefs({ action: 'unsubscribe', token: emailOnly.secrets.unsubscribeToken })).status === 200, 'Preferences page can fully unsubscribe');
  const gone = await prefs({ action: 'update', token: emailOnly.secrets.unsubscribeToken, emailConsent: true, whatsappConsent: true });
  const goneJson = await gone.json();
  check(goneJson.preferences.status === 'UNSUBSCRIBED' && goneJson.preferences.emailConsent === false, 'Unsubscribed is terminal: preferences cannot resurrect it');

  // 10. Cron: WhatsApp-only enablement and disabled state.
  const request = () => new Request('http://127.0.0.1/api/cron/launch-emails', { headers: { authorization: 'Bearer synthetic-cron-secret-value' } });
  process.env.CRON_SECRET = 'synthetic-cron-secret-value';
  delete process.env.LAUNCH_EMAIL_WORKER_ENABLED; delete process.env.WHATSAPP_WORKER_ENABLED;
  check((await cron.GET(request())).status === 503, 'Cron disabled when no channel enabled');
  process.env.WHATSAPP_WORKER_ENABLED = 'true';
  const cronResponse = await cron.GET(request());
  const cronJson = await cronResponse.json();
  check(cronResponse.status === 200 && cronJson.enabled === false && cronJson.whatsapp?.channel === 'WHATSAPP' && cronJson.campaignEmail === null, 'WhatsApp-only cron runs WhatsApp, not email');
  configureEmail();
  const both2 = await cron.GET(request());
  const both2Json = await both2.json();
  check(both2.status === 200 && both2Json.enabled === true && typeof both2Json.sent === 'number' && both2Json.campaignEmail?.channel === 'EMAIL', 'Cron keeps transactional counts top-level and adds campaign channels');

  console.log(`${checks} launch campaign assertions passed; Resend and Graph API mocked, no real transport`);
} finally {
  await prisma.$disconnect();
}
