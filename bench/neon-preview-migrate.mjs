// One-time bootstrap, exclusively the explicitly authorized empty Preview database.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir, freemem } from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import pg from 'pg';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
let migrationStarted = false;
try {
  const confirmations = [
    '--confirm-project=winter-queen-11288843',
    '--confirm-branch=br-summer-cake-b6dp3hnt',
    '--confirm-database=neondb',
    '--confirm-migrations=11',
  ];
  const args = process.argv.slice(2);
  if (args.length !== confirmations.length || !confirmations.every(flag => args.includes(flag))) {
    console.error('Manual confirmation of the exact Preview project, branch, database and eleven migrations is required. No connection attempted.');
    process.exitCode = 1;
  } else {
  // Performs strict URL/manifest checks and READ ONLY checks on both connections.
  const { verifiedInputs } = await import('./neon-preview-preflight.mjs');
  if (process.exitCode || !verifiedInputs) throw new Error('Preflight failed');
  if (freemem() < 400 * 1024 * 1024) throw new Error('Insufficient memory');
  const env = verifiedInputs.connections;
  const manifest = verifiedInputs.manifest;
  const stage = mkdtempSync(join(tmpdir(), 'inst-acessor-preview-migrate-'));
  cpSync(join(root, manifest.schemaSnapshot), join(stage, 'schema.prisma'));
  mkdirSync(join(stage, 'migrations'));
  cpSync(join(root, 'prisma/migrations/migration_lock.toml'), join(stage, 'migrations/migration_lock.toml'));
  for (const entry of manifest.migrations) {
    mkdirSync(join(stage, 'migrations', entry.migration));
    cpSync(join(root, 'prisma/migrations', entry.migration, 'migration.sql'), join(stage, 'migrations', entry.migration, 'migration.sql'));
  }
  if (createHash('sha256').update(readFileSync(join(stage, 'schema.prisma'))).digest('hex').toUpperCase() !== manifest.schemaSha256) throw new Error('Staged schema changed; stopped');
  for (const entry of manifest.migrations) {
    const stagedHash = createHash('sha256').update(readFileSync(join(stage, 'migrations', entry.migration, 'migration.sql'))).digest('hex').toUpperCase();
    if (stagedHash !== entry.sha256) throw new Error('Staged migration changed; stopped');
  }
  const childEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key];
  Object.assign(childEnv, { DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL,
    CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', PRISMA_HIDE_PREVIEW_FLAG_WARNINGS: '1' });
  let bytes = 0;
  async function prisma(args) {
  const child = spawn(process.execPath, [resolve(require.resolve('prisma/package.json'), '..', 'build/index.js'), ...args],
    { cwd: stage, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // Never relay CLI output: a provider/CLI error may contain a connection URL.
  child.stdout.on('data', chunk => { bytes += chunk.length; });
  child.stderr.on('data', chunk => { bytes += chunk.length; });
  const code = await new Promise((res, reject) => { child.once('error', reject); child.once('close', res); });
  if (code !== 0) throw new Error('Prisma verification failed');
  return code;
  }
  await prisma(['validate', '--schema', join(stage, 'schema.prisma')]);
  migrationStarted = true;
  const code = await prisma(['migrate', 'deploy', '--schema', join(stage, 'schema.prisma')]);
  const u = new URL(env.DIRECT_URL);
  const client = new pg.Client({ host: u.hostname, port: 5432, database: 'neondb',
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), ssl: { rejectUnauthorized: true },
    enableChannelBinding: true, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  let rows, tableCount;
  try {
    await client.connect(); await client.query('BEGIN READ ONLY');
    ({ rows } = await client.query('SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public."_prisma_migrations" ORDER BY migration_name'));
    ({ rows: [{ count: tableCount }] } = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
    await client.query('ROLLBACK');
  } finally { await client.end().catch(() => {}); }
  if (rows.length !== 11 || rows.some((row, i) => !row.finished || row.rolled_back ||
      row.migration_name !== manifest.migrations[i].migration || row.checksum.toUpperCase() !== manifest.migrations[i].sha256)) throw new Error('Post-migration verification failed');
  await prisma(['migrate', 'diff', '--from-schema-datasource', join(stage, 'schema.prisma'),
    '--to-schema-datamodel', join(stage, 'schema.prisma'), '--exit-code']);
  writeFileSync(join(root, 'outputs/verification/neon-migration-result.json'), JSON.stringify({
    completedAt: new Date().toISOString(), project: manifest.project, branch: manifest.branch, database: manifest.database,
    operation: 'prisma migrate deploy', cliExitCode: code, appliedAndVerified: rows.length, publicBaseTables: tableCount,
    checksumsMatch: true, schemaValidated: true, schemaDrift: false, reset: false, seed: false, productionAccessed: false,
    migrations: rows.map(row => row.migration_name), cliOutputBytesWithheld: bytes,
  }, null, 2));
  console.log('Eleven Preview migrations applied and verified, checksums matched. No reset/seed/production access.');
  }
} catch (error) {
  if (error?.message === 'Insufficient memory') console.error('Insufficient RAM for Prisma; no migration started.');
  else console.error(migrationStarted ? 'Migration/postflight stopped. Do not retry automatically; inspect migration history read-only. Provider output withheld.' : 'Preflight stopped; no migration started. Details/credentials withheld.');
  process.exitCode = 1;
}
