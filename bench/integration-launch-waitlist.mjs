import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';

// Local test preparation is NOT permission to apply a twelfth migration to Neon.
// Require the additive migration name explicitly; never glob pending SQL files.
const root = resolve(import.meta.dirname, '..');
const addition = process.argv.find(value => value.startsWith('--migration='))?.slice(12);
assert.match(addition ?? '', /^\d{14}_launch_waitlist$/, 'Pass the reviewed local-only migration explicitly');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/neon-preview-migration-manifest.json'), 'utf8'));
assert.equal(manifest.migrations.length, 11, 'Review this driver again if the approved historical manifest changes');
const migrations = manifest.migrations.map(entry => {
  const sql = readFileSync(resolve(root, 'prisma/migrations', entry.migration, 'migration.sql'), 'utf8');
  assert.equal(createHash('sha256').update(sql).digest('hex').toUpperCase(), entry.sha256.toUpperCase(), `Historical SQL changed: ${entry.migration}`);
  return sql;
});
assert.ok(!manifest.migrations.some(entry => entry.migration === addition));
const additiveSql = readFileSync(resolve(root, 'prisma/migrations', addition, 'migration.sql'), 'utf8');

// Only OS runtime survives; all database, auth, messaging and service credentials
// are removed before initdb, imported application code or child processes run.
const env = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA']) {
  if (process.env[key]) env[key] = process.env[key];
}
for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
const port = await new Promise((done, reject) => {
  const server = createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => done(value)); });
});
const folder = resolve(root, `outputs/launch-waitlist-postgres-${Date.now()}`);
mkdirSync(folder, { recursive: true });
const postgres = new LocalPostgres(folder, port);
const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
Object.assign(env, {
  DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port),
  NODE_ENV: 'test', TOKEN_ENCRYPTION_KEY: 'synthetic-launch-waitlist-encryption-key-only',
  NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"`,
});
try {
  await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
  const client = new Client({ connectionString: url }); await client.connect();
  try {
    for (const sql of migrations) await client.query(sql);
    await client.query(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('launch-migration-fixture','preserved-launch@audit.invalid',CURRENT_TIMESTAMP)`);
    await client.query(additiveSql);
    assert.equal((await client.query(`SELECT count(*) FROM "User" WHERE id='launch-migration-fixture'`)).rows[0].count, '1');
    console.log('Additive launch migration preserved the synthetic preexisting user.');
  } finally { await client.end(); }
  const child = spawn(process.execPath, ['--import', './bench/register-ts-alias.mjs', 'bench/test-launch-waitlist.mjs', '--database'], { cwd: root, env, windowsHide: true });
  let output = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
  writeFileSync(resolve(folder, 'assertions.log'), output);
  process.stdout.write(output);
  assert.equal(exit, 0); assert.match(output, /\d+ launch waitlist database assertions passed/);
} finally { await postgres.stop(); }
