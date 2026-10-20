// Explicit target only. Never imports application/Prisma or loads the original env.
import { parseEnv } from 'node:util';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const root = resolve(import.meta.dirname, '..');
// In-memory only. Allows the manual driver to use exactly the inputs verified,
// instead of reopening a credentials file that might change after preflight.
export let verifiedInputs = null;
const expected = {
  project: 'winter-queen-11288843', branch: 'br-summer-cake-b6dp3hnt', database: 'neondb',
  direct: 'ep-muddy-resonance-b6dt5n2n.c-2.sa-east-1.aws.neon.tech',
  pool: 'ep-muddy-resonance-b6dt5n2n-pooler.c-2.sa-east-1.aws.neon.tech',
};
const fail = message => { throw new Error(message); };
function connection(value, host) {
  let u; try { u = new URL(value); } catch { fail('Invalid or empty dedicated connection'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || u.hostname !== host || (u.port && u.port !== '5432') ||
      u.pathname !== `/${expected.database}` || u.hash || !u.username || !u.password ||
      u.searchParams.get('sslmode') !== 'require' || u.searchParams.get('channel_binding') !== 'require') fail('Dedicated connection target/TLS mismatch');
  const allowed = new Set(['sslmode', 'channel_binding', 'connect_timeout', 'connection_limit', 'pool_timeout']);
  if ([...u.searchParams.keys()].some(key => !allowed.has(key))) fail('Unexpected connection option');
  for (const key of allowed) if (u.searchParams.getAll(key).length > 1) fail('Duplicate connection option');
  return { host: u.hostname, port: 5432, database: expected.database,
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true,
    connectionTimeoutMillis: 15000, query_timeout: 15000, application_name: 'inst-acessor-preview-preflight' };
}

async function inspect(config) {
  const client = new pg.Client(config);
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows: [row] } = await client.query(`SELECT current_database() AS database,
      current_user AS role, current_setting('server_version') AS version,
      has_schema_privilege(current_user,'public','USAGE') AS can_use_public,
      has_schema_privilege(current_user,'public','CREATE') AS can_create_public,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
       AND n.nspname NOT LIKE 'pg_temp%' AND c.relkind IN ('r','p','v','m','S','f')) AS user_relations,
      to_regclass('public."_prisma_migrations"') IS NOT NULL AS migration_history`);
    await client.query('ROLLBACK');
    if (row.database !== expected.database || row.role !== config.user || !row.can_use_public || !row.can_create_public ||
        row.user_relations !== 0 || row.migration_history) fail('Unexpected database state; bootstrap stopped');
    return { host: config.host, ...row, tlsCertificateVerified: true };
  } finally { await client.end().catch(() => {}); }
}

try {
  const env = parseEnv(readFileSync(resolve(root, '.env.preview.local'), 'utf8'));
  const pool = connection(env.DATABASE_URL, expected.pool);
  const direct = connection(env.DIRECT_URL, expected.direct);
  if (pool.user !== direct.user || pool.password !== direct.password) fail('Pool/direct identity mismatch');
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/neon-preview-migration-manifest.json'), 'utf8'));
  if (manifest.project !== expected.project || manifest.branch !== expected.branch || manifest.database !== expected.database ||
      manifest.authorization !== 'GRANTED_EXACT_TARGET_ONLY_2026-10-20') fail('Migration authorization target mismatch');
  // Later local migrations are NOT covered by the eleven-only remote approval.
  const migrations = manifest.migrations.map(entry => entry.migration);
  if (migrations.length !== 11 || JSON.stringify([...migrations].sort()) !== JSON.stringify(migrations)) fail('Migration count mismatch');
  if (manifest.schemaSnapshot !== 'bench/fixtures/neon-approved-eleven.prisma' ||
      createHash('sha256').update(readFileSync(resolve(root, manifest.schemaSnapshot))).digest('hex').toUpperCase() !== manifest.schemaSha256) fail('Migration manifest changed');
  for (const [i, name] of migrations.entries()) {
    const hash = createHash('sha256').update(readFileSync(resolve(root, 'prisma/migrations', name, 'migration.sql'))).digest('hex').toUpperCase();
    if (manifest.migrations[i].migration !== name || manifest.migrations[i].sha256 !== hash) fail('Migration manifest changed');
  }
  console.log('Dedicated pool/direct URL targets, TLS and eleven migration hashes verified; no credentials printed.');
  const directState = await inspect(direct);
  const poolState = await inspect(pool);
  const evidence = { checkedAt: new Date().toISOString(), target: expected,
    migrationsVerified: 11, direct: directState, pool: poolState,
    operations: 'READ ONLY', migrationsExecuted: false, productionAccessed: false };
  mkdirSync(resolve(root, 'outputs/verification'), { recursive: true });
  writeFileSync(resolve(root, 'outputs/verification/neon-connections-preflight.json'), JSON.stringify(evidence, null, 2));
  verifiedInputs = Object.freeze({ connections: Object.freeze({ DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL }), manifest });
  console.log('Both dedicated connections passed read-only preflight; database empty; migrations NOT executed.');
} catch (error) {
  // Driver/library errors can contain connection parameters. Never print them.
  const safe = ['Invalid or empty dedicated connection', 'Dedicated connection target/TLS mismatch', 'Unexpected connection option',
    'Duplicate connection option', 'Pool/direct identity mismatch', 'Migration authorization target mismatch',
    'Migration count mismatch', 'Migration manifest changed', 'Unexpected database state; bootstrap stopped'];
  console.error(safe.includes(error?.message) ? error.message : 'Preflight could not complete; credentials and provider error withheld. No migrations executed.');
  process.exitCode = 1;
}
