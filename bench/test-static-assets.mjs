import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const base = 'http://127.0.0.1:3107';
await new Promise((resolve, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(3107, '127.0.0.1', () => probe.close(resolve));
});
const server = spawn(process.execPath, [resolve(require.resolve('next/package.json'), '..', 'dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3107'], { cwd: root, env: process.env, windowsHide: true });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
const results = [];
try {
  for (let attempt = 0; !serverLog.includes('Ready'); attempt++) {
    if (server.exitCode !== null || attempt >= 60) throw new Error('Own static test server did not start');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  for (const channel of [undefined, 'msedge']) {
    const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    try {
      const context = await browser.newContext();
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      for (const path of ['/favicon.svg','/manifest.webmanifest','/sw.js','/icons/icon-192.svg','/icons/icon-512.svg','/icons/maskable-512.svg']) {
        const response = await context.request.get(base + path);
        assert.equal(response.status(), 200, path);
        results.push({ browser: channel ? 'Edge' : 'Chromium', version: browser.version(), path, status: response.status() });
      }
      const page = await context.newPage();
      const response = await page.goto(base + '/favicon.svg');
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('svg').count(), 1);
      results.push({ browser: channel ? 'Edge' : 'Chromium', assertion: 'favicon renders as SVG', passed: true });
    } finally { await browser.close(); }
  }
  writeFileSync(resolve(root, 'outputs/verification/static-assets-results.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length} static asset assertions passed`);
} finally {
  server.kill();
  writeFileSync(resolve(root, 'outputs/verification/static-assets-server.log'), serverLog);
}
