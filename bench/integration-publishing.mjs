import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const mode = process.argv[2] ?? 'publishing';
if (!['publishing', 'password-reset'].includes(mode)) throw new Error('Unknown isolated integration mode');
const port = await new Promise((res, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => res(port)); }); });
const folder = resolve(root, `outputs/publishing-postgres-${Date.now()}`);
mkdirSync(folder, { recursive: true });
const pg = new LocalPostgres(folder, port);
const env = { ...process.env };
for (const key of Object.keys(env)) if (/DATABASE|DIRECT_URL|SECRET|TOKEN|API_KEY|PASSWORD|ASAAS|INSTAGRAM|META_|TIKTOK|RESEND|SMTP|OPENAI|GEMINI|AUTH_URL|NEXTAUTH|EMAIL_|ADMIN_EMAIL|BENCH_ALLOW_STAGING|NODE_OPTIONS/i.test(key)) delete env[key];
const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
Object.assign(env, { DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port), ADMIN_EMAIL: 'admin@audit.invalid', NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"` });
async function run(args) {
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true });
  let output = ''; child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
  const code = await new Promise((res, reject) => { child.once('error', reject); child.once('close', res); });
  if (code !== 0) throw new Error(output.slice(-3000));
  return output;
}
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('inst_acessor_audit');
  const client = new Client({ connectionString: url }); await client.connect();
  try {
    const migrations=readdirSync(resolve(root,'prisma/migrations')).filter(name=>/^\d/.test(name)).sort();
    for(const name of migrations){await client.query(readFileSync(resolve(root,'prisma/migrations',name,'migration.sql'),'utf8'));if(name==='20260901000000_baseline_historico')await client.query(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('snapshot-migration-fixture','snapshot-preserved@audit.invalid',CURRENT_TIMESTAMP)`);}
    if((await client.query(`SELECT count(*) FROM "User" WHERE id='snapshot-migration-fixture'`)).rows[0].count!=='1')throw new Error('Migration lost fixture');
    const drift=await run([resolve(require.resolve('prisma/package.json'),'..','build/index.js'),'migrate','diff','--from-url',url,'--to-schema-datamodel','prisma/schema.prisma','--script']);
    if(/^(ALTER|CREATE|DROP) /m.test(drift))throw new Error('Schema drift after migration chain');
    writeFileSync(resolve(root,'outputs/publication-migrations.log'),`${migrations.length} migrations applied in order; historical fixture preserved; no schema drift.`);
  } finally { await client.end(); }
  if (mode === 'password-reset') {
    const reset = await run(['--import', './bench/register-ts-alias.mjs', 'bench/test-password-reset.mjs']);
    if (!reset.includes('password reset assertions passed')) throw new Error('Incomplete password reset test output');
    writeFileSync(resolve(root, 'outputs/password-reset.log'), reset);
    process.stdout.write(reset);
  } else {
  const result = await run(['--import', './bench/register-ts-alias.mjs', 'bench/test-publishing-reconciliation.mjs']);
  if (!result.includes('publishing reconciliation assertions passed')) throw new Error('Incomplete test output');
  writeFileSync(resolve(root, 'outputs/publishing-reconciliation.log'), result);
  process.stdout.write(result);
  const flow=await run(['--import','./bench/register-ts-alias.mjs','bench/test-editor-publishing.mjs']);
  if(!flow.includes('editor publishing assertions passed'))throw new Error('Incomplete pipeline test output');
  writeFileSync(resolve(root,'outputs/editor-publishing.log'),flow);process.stdout.write(flow);
  const gamification=await run(['--import','./bench/register-ts-alias.mjs','bench/test-gamification-concurrency.mjs']);
  if(!gamification.includes('gamification concurrency assertions passed'))throw new Error('Incomplete gamification test output');
  writeFileSync(resolve(root,'outputs/gamification-concurrency.log'),gamification);process.stdout.write(gamification);
  }
} finally { await pg.stop(); }
