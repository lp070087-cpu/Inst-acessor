import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
console.log('Integration driver starting with disposable loopback-only database.');
const database = 'inst_acessor_audit';
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const selected = probe.address().port;
    probe.close(() => resolve(selected));
  });
});
const cluster = resolve(root, `outputs/postgres-${Date.now()}`);
mkdirSync(cluster, { recursive: true });
const pg = new LocalPostgres(cluster, port);
const url = `postgresql://audit:audit@127.0.0.1:${port}/${database}?connection_limit=12`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port),
  NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"` };
const prismaCli = resolve(require.resolve('prisma/package.json'), '..', 'build/index.js');
async function run(args, name) {
  let stdout = '', stderr = '';
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true });
  child.stdout.on('data', (chunk) => { stdout += chunk; if (name === 'e2e-local') process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  writeFileSync(resolve(root, `outputs/verification/${name}.log`), stdout + stderr);
  if (code !== 0) throw new Error(`${name} failed (${code}): ${(stdout + stderr).slice(-5000)}`);
  if (name === 'integration-tests' && !/\d+ database integration assertions passed/.test(stdout)) throw new Error('Integration child did not complete its assertions');
  if (name === 'e2e-local' && !/\d+ local observations; 0 failures; 0 page errors/.test(stdout)) throw new Error('E2E child did not complete its assertions');
  return stdout;
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  console.log('Disposable PostgreSQL started on loopback; no existing database used.');
  const client = new Client({ connectionString: url });
  await client.connect();
  const schema = await run([prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], 'schema-empty');
  await client.query(schema);
  const version = await client.query('SELECT version()');
  console.log(version.rows[0].version);
  await client.end();
  // Separately prove whether historical incremental migrations bootstrap an empty DB.
  await pg.createDatabase('inst_acessor_audit_migrations');
  const migrationClient = new Client({ connectionString: url.replace('/inst_acessor_audit?', '/inst_acessor_audit_migrations?') });
  await migrationClient.connect();
  let migrationFailure = null;
  try {
    for (const folder of readdirSync(resolve(root, 'prisma/migrations')).sort()) {
      if (!/^\d/.test(folder)) continue;
      await migrationClient.query(readFileSync(resolve(root, 'prisma/migrations', folder, 'migration.sql'), 'utf8'));
      if (folder === '20260901000000_baseline_historico') {
        await migrationClient.query(`INSERT INTO "User" (id, email, "passwordHash", "updatedAt") VALUES ('baseline-audit-user', 'baseline@audit.invalid', 'synthetic-placeholder', CURRENT_TIMESTAMP)`);
      }
    }
    writeFileSync(resolve(root, 'outputs/verification/historical-migrations.log'), 'PASS: all historical migrations applied to empty database');
    const drift = await run([prismaCli, 'migrate', 'diff', '--from-url', url.replace('/inst_acessor_audit?', '/inst_acessor_audit_migrations?'), '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], 'historical-schema-drift');
    if (/^(ALTER|CREATE|DROP) /m.test(drift)) {
      throw new Error('Schema drift remains in historical-schema-drift.log');
    }
    const preserved = await migrationClient.query(`SELECT count(*) FROM "User" WHERE id='baseline-audit-user' AND email='baseline@audit.invalid'`);
    if (Number(preserved.rows[0].count) !== 1) throw new Error('Historical fixture was not preserved');
    writeFileSync(resolve(root, 'outputs/verification/historical-migrations.log'), 'PASS: empty database bootstrapped; incremental migrations preserve synthetic user; final schema has no drift');
  } catch (error) {
    migrationFailure = error;
    writeFileSync(resolve(root, 'outputs/verification/historical-migrations.log'), `BLOCKED: incremental migration history cannot bootstrap empty DB: ${error.message}`);
  } finally { await migrationClient.end(); }
  await run(['--import', './bench/register-ts-alias.mjs', 'bench/integration-tests.mjs'], 'integration-tests');
  console.log('Database integration tests passed.');
  if (migrationFailure) throw migrationFailure;
  if (process.argv.includes('--e2e')) {
    await run(['bench/e2e-local.mjs'], 'e2e-local');
    console.log('Local E2E completed.');
  }
} finally {
  await pg.stop();
  console.log('Disposable PostgreSQL stopped. Test cluster retained under ignored outputs.');
}
