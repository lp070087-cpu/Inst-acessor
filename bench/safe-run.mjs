import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const mode = process.argv[2] ?? 'offline';
const env = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA']) {
  if (process.env[key]) env[key] = process.env[key];
}
Object.assign(env, {
  DATABASE_URL: 'postgresql://audit:audit@127.0.0.1:1/inst_acessor_audit',
  DIRECT_URL: 'postgresql://audit:audit@127.0.0.1:1/inst_acessor_audit',
  AUTH_URL: 'http://127.0.0.1:3107', NEXTAUTH_URL: 'http://127.0.0.1:3107',
  NEXTAUTH_SECRET: 'audit-only-fictitious-session-secret-2026',
  TOKEN_ENCRYPTION_KEY: 'audit-only-fictitious-encryption-key-2026',
  ADMIN_EMAIL: 'admin@audit.invalid', ASAAS_ENV: 'sandbox',
  PUBLISHING_WORKER_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"`,
});
mkdirSync(resolve(root, 'outputs/verification'), { recursive: true });
async function run(name, args) {
  const logfile = resolve(root, `outputs/verification/${name}.log`);
  writeFileSync(logfile, '');
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { output += data; appendFileSync(logfile, data); });
  const code = await new Promise((resolve) => child.on('close', resolve));
  writeFileSync(resolve(root, `outputs/verification/${name}.log`), output);
  console.log(`${name}: exit ${code}`);
  if (code !== 0) console.log(output.slice(-4000));
  const completion = name.startsWith('e2e') ? 'Local E2E completed.' : name === 'integration' ? 'Database integration tests passed.' : name === 'assets' ? 'static asset assertions passed' : null;
  if (completion && !output.includes(completion)) {
    console.error(`${name}: missing verified completion marker`);
    return false;
  }
  return code === 0;
}
const tool = (pkg, path) => resolve(require.resolve(`${pkg}/package.json`), '..', path);
let ok = true;
if (mode === 'offline') {
  const scripts = ['test-capacity-module', 'test-usage-windows', 'test-quotas', 'test-planos', 'test-promo-landing', 'test-repetition', 'test-gemini-models', 'direct-core', 'direct-webhook', 'test-security'];
  for (const name of scripts) ok = await run(name, ['--import', './bench/register-ts-alias.mjs', `bench/${name}.mjs`]) && ok;
  ok = await run('test-asaas-flows', ['--import', './bench/register-asaas-tests.mjs', 'bench/test-asaas-flows.mjs']) && ok;
} else if (mode === 'typecheck') {
  // Next 15's next-env references generated route types even on a fresh clone.
  ok = await run('typegen', [tool('next', 'dist/bin/next'), 'typegen']);
  if (ok) ok = await run(mode, [tool('typescript', 'bin/tsc'), '--noEmit', '--incremental', 'false']);
} else if (mode === 'lint') {
  ok = await run(mode, [tool('next', 'dist/bin/next'), 'lint', '--no-cache']);
} else if (mode === 'schema') {
  ok = await run(mode, [tool('prisma', 'build/index.js'), 'validate']);
} else if (mode === 'generate') {
  // Generates only the local client, with unreachable fictitious database URLs.
  ok = await run(mode, [tool('prisma', 'build/index.js'), 'generate']);
} else if (mode === 'product') {
  for (const name of ['test-media-editor', 'test-video-project', 'test-social-capabilities', 'test-instagram-status', 'test-asaas-checkout-contract', 'test-ai-budget', 'test-tiktok-inbox', 'test-tiktok-status', 'test-reel-cover', 'test-image-crop']) {
    ok = await run(name, ['--import', './bench/register-ts-alias.mjs', `bench/${name}.mjs`]) && ok;
  }
  ok = await run('test-publishing-scheduler', ['bench/test-publishing-scheduler.mjs']) && ok;
} else if (mode === 'preview-config') {
  ok = await run(mode, ['bench/test-preview-config.mjs']);
} else if (mode === 'tiktok-options') {
  ok = await run(mode, ['--import', './bench/register-ts-alias.mjs', 'bench/test-tiktok-publishing-options.mjs']);
} else if (mode === 'ai-security') {
  ok = await run(mode, ['--import', './bench/register-ts-alias.mjs', 'bench/test-ai-provider-security.mjs']);
} else if (mode === 'launch-waitlist') {
  ok = await run(mode, ['--import', './bench/register-ts-alias.mjs', 'bench/test-launch-waitlist.mjs']);
} else if (mode === 'baseline') {
  ok = await run(mode, [tool('prisma', 'build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'bench/fixtures/prebilling-schema.prisma', '--script']);
} else if (mode === 'build') {
  ok = await run(mode, [tool('next', 'dist/bin/next'), 'build']);
 } else if (mode === 'build-product-serial') {
  // Lint finishes before Next starts its type worker; no verification is skipped.
  env.NEXT_OUTPUT_DIR = 'outputs/product-build';
  ok = await run('lint-product-serial', [tool('next', 'dist/bin/next'), 'lint', '--no-cache']);
  if (ok) ok = await run(mode, [tool('next', 'dist/bin/next'), 'build', '--no-lint']);
} else if (mode === 'build-product') {
  // Exclusive ignored output, never shared with dev or the previous delivery.
  env.NEXT_OUTPUT_DIR = 'outputs/product-build';
  ok = await run(mode, [tool('next', 'dist/bin/next'), 'build']);
} else if (['integration', 'e2e', 'e2e-edge', 'e2e-regression', 'e2e-growth'].includes(mode)) {
  // This driver starts its own allowlisted, disposable PostgreSQL cluster.
  env.NODE_OPTIONS = '';
  if (mode === 'e2e-edge') env.AUDIT_BROWSER = 'edge';
  if (mode === 'e2e-regression') env.AUDIT_E2E_SCOPE = 'regression';
  if (mode === 'e2e-growth') env.AUDIT_E2E_SCOPE = 'growth';
  ok = await run(mode, ['bench/integration.mjs', ...(mode.startsWith('e2e') ? ['--e2e'] : [])]);
} else if (mode === 'diagnose') {
  ok = await run(mode, ['bench/diagnose-overflow.mjs']);
} else if (mode === 'assets') {
  ok = await run(mode, ['bench/test-static-assets.mjs']);
} else if (mode === 'security') {
  ok = await run('test-security', ['--import', './bench/register-ts-alias.mjs', 'bench/test-security.mjs']);
} else {
  throw new Error(`Unknown verification mode: ${mode}`);
}
process.exitCode = ok ? 0 : 1;
