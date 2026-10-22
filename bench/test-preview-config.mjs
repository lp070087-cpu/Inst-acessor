import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../next.config.mjs';

// The safe-run driver supplies a sanitized environment and blocks outbound traffic.
const keys = ['NODE_ENV', 'VERCEL_ENV', 'INST_DEMO_MODE'];
const previous = new Map(keys.map(key => [key, process.env[key]]));
let count = 0;
function check(value, message) { assert.ok(value, message); count++; console.log(`ok ${message}`); }
try {
  const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const blocked = ['audit/finalizacao-inst-acessor', 'claude/charming-feynman-wjik0j'];
  check(blocked.every(branch => deployment.git.deploymentEnabled[branch] === false), 'Finalization branches never trigger automatic Vercel deployment');
  check(Object.keys(deployment.git.deploymentEnabled).length === blocked.length, 'Other branches retain their existing deployment behavior');
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'preview';
  delete process.env.INST_DEMO_MODE;
  let rules = await config.headers();
  check(rules.length === 1 && rules[0].source === '/:path*', 'Preview rule covers every route');
  check(rules[0].headers.some(h => h.key === 'X-Robots-Tag' && h.value === 'noindex, nofollow, noarchive'), 'Preview requests no indexing or archive');
  check(rules[0].headers.length === 1, 'Preview rule introduces no cache or authentication override');
  process.env.VERCEL_ENV = 'production';
  check((await config.headers()).length === 0, 'Production does not inherit Preview headers');
  delete process.env.VERCEL_ENV;
  process.env.NODE_ENV = 'development';
  check((await config.headers()).length === 0, 'Ordinary local development keeps existing behavior');
  process.env.INST_DEMO_MODE = '1';
  rules = await config.headers();
  check(rules.length === 1 && rules[0].source === '/demo/:path*', 'Development demo retains its own rule');
  check(rules[0].headers.some(h => h.key === 'Content-Security-Policy' && h.value.includes("connect-src 'self'")), 'Demo connection restrictions remain present');
  process.env.VERCEL_ENV = 'preview';
  rules = await config.headers();
  check(rules.length === 2, 'Preview and demo rules compose without replacing each other');
} finally {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log(`${count} preview configuration assertions passed`);
