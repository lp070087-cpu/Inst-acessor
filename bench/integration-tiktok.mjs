import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';

const root = resolve(import.meta.dirname, '..');
if (!process.argv.includes('--cases')) {
  // OS runtime only: no inherited service credentials or .env fallback.
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA']) if (process.env[key]) env[key] = process.env[key];
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  const port = await new Promise((res, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => res(value)); }); });
  const folder = resolve(root, `outputs/tiktok-postgres-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const postgres = new LocalPostgres(folder, port);
  const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
  Object.assign(env, { DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port), NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"` });
  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
    const client = new Client({ connectionString: url }); await client.connect();
    try {
      const folders = readdirSync(resolve(root, 'prisma/migrations')).filter(name => /^\d/.test(name)).sort();
      for (const name of folders.filter(name => name !== '20261018190000_social_webhook_inbox')) await client.query(readFileSync(resolve(root, 'prisma/migrations', name, 'migration.sql'), 'utf8'));
      await client.query(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('tiktok-migration-fixture','preserved@audit.invalid',CURRENT_TIMESTAMP)`);
      await client.query(readFileSync(resolve(root, 'prisma/migrations/20261018190000_social_webhook_inbox/migration.sql'), 'utf8'));
      assert.equal((await client.query(`SELECT count(*) FROM "User" WHERE id='tiktok-migration-fixture'`)).rows[0].count, '1');
      console.log('Additive inbox migration preserved synthetic existing user.');
    } finally { await client.end(); }
    const child = spawn(process.execPath, ['--import', './bench/register-ts-alias.mjs', 'bench/integration-tiktok.mjs', '--cases'], { cwd: root, env, windowsHide: true });
    let output = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
    const exit = await new Promise((res, reject) => { child.once('error', reject); child.once('close', res); });
    writeFileSync(resolve(root, 'outputs/tiktok-inbox.log'), output);
    process.stdout.write(output);
    assert.equal(exit, 0); assert.match(output, /\d+ TikTok database assertions passed/);
  } finally { await postgres.stop(); }
} else {
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
  assert.equal(target.pathname, '/inst_acessor_audit'); assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  globalThis.fetch = async () => { throw new Error('Provider network prohibited'); };
  const { prisma } = await import('../src/lib/db.ts');
  const { createHmac } = await import('node:crypto');
  const { POST: webhook } = await import('../src/app/api/webhooks/tiktok/route.ts');
  const { GET: cron } = await import('../src/app/api/cron/social-webhooks/route.ts');
  const { normalizeTikTokEvent, ingestTikTokEvent, claimTikTokEvent, applyTikTokEvent, failTikTokEvent, processTikTokInbox } = await import('../src/lib/integrations/tiktok/webhook-inbox.ts');
  let checks = 0;
  const check = (value, name) => { assert.ok(value, name); checks++; console.log(`ok ${name}`); };
  check((await webhook(new Request('https://audit.invalid/webhook', { method: 'POST', body: '{}' }))).status === 503, 'Ingress disabled without explicit flag');
  process.env.TIKTOK_WEBHOOK_INBOX_ENABLED = 'true'; process.env.TIKTOK_CLIENT_KEY = 'synthetic-client';
  process.env.TIKTOK_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  const beforeLimiter = await prisma.verificationToken.count();
  check((await webhook(new Request('https://audit.invalid/webhook', { method: 'POST', body: '{invalid' }))).status === 403, 'Signature rejected before JSON parse');
  check(await prisma.verificationToken.count() === beforeLimiter, 'Invalid signature never touches database limiter');
  const malformed = '{invalid'; const ts = String(Math.floor(Date.now() / 1000));
  const signature = `t=${ts},s=${createHmac('sha256', process.env.TIKTOK_WEBHOOK_SECRET).update(`${ts}.${malformed}`).digest('hex')}`;
  check((await webhook(new Request('https://audit.invalid/webhook', { method: 'POST', body: malformed, headers: { 'TikTok-Signature': signature } }))).status === 400, 'Signed invalid JSON rejected honestly');
  check(await prisma.socialWebhookInbox.count() === 0, 'Invalid envelope not durably acknowledged');
  process.env.CRON_SECRET = 'synthetic-cron-secret';
  check((await cron(new Request('https://audit.invalid/cron'))).status === 401, 'Scheduler rejects missing authentication');
  check(!(await (await cron(new Request('https://audit.invalid/cron', { headers: { authorization: 'Bearer synthetic-cron-secret' } }))).json()).enabled, 'Authenticated scheduler remains disabled by default');
  const epoch = Math.floor(Date.now() / 1000) - 2;
  const old = new Date((epoch - 100) * 1000);
  const user = await prisma.user.create({ data: { email: 'tiktok-owner@audit.invalid' } });
  const other = await prisma.user.create({ data: { email: 'tiktok-other@audit.invalid' } });
  const connection = await prisma.socialConnection.create({ data: { userId: user.id, platform: 'tiktok', externalAccountId: 'synthetic-openid', status: 'CONNECTED', tokenEncrypted: 'synthetic-never-real', updatedAt: old } });
  const foreign = await prisma.socialConnection.create({ data: { userId: other.id, platform: 'tiktok', externalAccountId: 'foreign-openid', status: 'CONNECTED', tokenEncrypted: 'foreign-never-real', updatedAt: old } });
  const event = (time, name = 'authorization.removed', account = 'synthetic-openid') => normalizeTikTokEvent(JSON.stringify({ client_key: 'synthetic-client', event: name, create_time: time, user_openid: account, content: JSON.stringify({ reason: 1, token: 'not-stored', email: 'not-stored@audit.invalid' }) }), 'synthetic-client');
  const input = event(epoch);
  const rows = await Promise.all(Array.from({ length: 12 }, () => ingestTikTokEvent(input)));
  check(new Set(rows.map(row => row.id)).size === 1, 'Concurrent redelivery creates one inbox entry');
  const row = await prisma.socialWebhookInbox.findUniqueOrThrow({ where: { eventKey: input.eventKey } });
  check(!JSON.stringify(row).includes('not-stored') && !JSON.stringify(row).includes('synthetic-openid'), 'No raw envelope or external identifier persisted');
  const claims = await Promise.all(Array.from({ length: 12 }, () => claimTikTokEvent(row.id)));
  check(claims.filter(Boolean).length === 1, 'Exactly one worker claims inbox');
  const token = claims.find(Boolean);
  check(await applyTikTokEvent(row.id, token) === 'PROCESSED', 'Verified removal applied locally');
  check(await applyTikTokEvent(row.id, token) === 'CONFLICT', 'Same claim cannot apply twice');
  check((await prisma.socialConnection.findUniqueOrThrow({ where: { id: connection.id } })).tokenEncrypted === null, 'Revocation removes stored credential');
  check((await prisma.socialConnection.findUniqueOrThrow({ where: { id: foreign.id } })).status === 'CONNECTED', 'Other account remains connected');
  check((await ingestTikTokEvent(input)).state === 'PROCESSED', 'Redelivery never resets processed state');
  const unknown = await ingestTikTokEvent(event(epoch, 'post.publish.complete'));
  check(unknown.state === 'QUARANTINED', 'Publication event not advertised as implemented');
  check(await claimTikTokEvent(unknown.id) === null, 'Unsupported event cannot run');
  const stale = await ingestTikTokEvent(event(epoch - 200));
  const staleToken = await claimTikTokEvent(stale.id);
  check(await applyTikTokEvent(stale.id, staleToken) === 'QUARANTINED', 'Old event cannot disconnect a newer connection');
  await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: 'CONNECTED', tokenEncrypted: 'new-fixture', updatedAt: old } });
  const recover = await ingestTikTokEvent(event(epoch + 1));
  const abandoned = await claimTikTokEvent(recover.id);
  await prisma.socialWebhookInbox.update({ where: { id: recover.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
  const recovered = await claimTikTokEvent(recover.id);
  check(recovered && recovered !== abandoned, 'Dead worker lease reclaimed with new token');
  check(await applyTikTokEvent(recover.id, abandoned) === 'CONFLICT', 'Stale worker fenced out after reclaim');
  check(await applyTikTokEvent(recover.id, recovered) === 'PROCESSED', 'Recovered worker commits once');
  await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: 'CONNECTED', tokenEncrypted: 'newer-fixture', updatedAt: old } });
  const changed = await ingestTikTokEvent(event(epoch + 2));
  await prisma.socialConnection.update({ where: { id: connection.id }, data: { tokenEncrypted: 'reconnected-fixture' } });
  check(await applyTikTokEvent(changed.id, await claimTikTokEvent(changed.id)) === 'QUARANTINED', 'Reconnect between ingestion and effect protected by version CAS');
  await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: 'CONNECTED', tokenEncrypted: 'rollback-fixture', updatedAt: old } });
  const crash = await ingestTikTokEvent(event(epoch + 3));
  const crashToken = await claimTikTokEvent(crash.id);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_inbox_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state = 'PROCESSED' THEN RAISE EXCEPTION 'synthetic commit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER audit_inbox_fail BEFORE UPDATE ON "SocialWebhookInbox" FOR EACH ROW EXECUTE FUNCTION audit_inbox_fail()`);
  try { await assert.rejects(() => applyTikTokEvent(crash.id, crashToken)); checks++; }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER audit_inbox_fail ON "SocialWebhookInbox"`); await prisma.$executeRawUnsafe(`DROP FUNCTION audit_inbox_fail()`); }
  check((await prisma.socialConnection.findUniqueOrThrow({ where: { id: connection.id } })).tokenEncrypted === 'rollback-fixture', 'Crash after local effect rolls credential change back');
  check((await prisma.socialWebhookInbox.findUniqueOrThrow({ where: { id: crash.id } })).state === 'PROCESSING', 'Crash does not mark event processed');
  await failTikTokEvent(crash.id, crashToken);
  check((await prisma.socialWebhookInbox.findUniqueOrThrow({ where: { id: crash.id } })).state === 'RETRY', 'Local transactional failure gets bounded retry');
  delete process.env.SOCIAL_WEBHOOK_WORKER_ENABLED;
  check(!(await processTikTokInbox()).enabled, 'Worker disabled without explicit flag');
  const publishedBefore = await prisma.publishQueue.count({ where: { status: 'PUBLICADO' } });
  check(publishedBefore === 0, 'Webhook inbox never fabricates publication success');
  await prisma.$disconnect();
  console.log(`${checks} TikTok database assertions passed`);
}
