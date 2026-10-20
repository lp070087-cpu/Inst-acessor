import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// This test never starts a server, loads environment files or authenticates.
const base = 'http://127.0.0.1:3107';
const output = resolve(import.meta.dirname, '../outputs/demo');
mkdirSync(output, { recursive: true });
const report = { viewports: [], blockedRequests: [], pageErrors: [], accessibility: [] };
console.log('Starting installed Edge for loopback-only demo checks.');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
console.log(`Edge ${browser.version()} ready.`);
try {
  for (const width of [320, 360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
        report.blockedRequests.push({ width, origin: url.origin, path: url.pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(300000);
    page.on('pageerror', error => report.pageErrors.push({ width, message: error.message }));
    for (const screen of ['dashboard', 'calendario', 'publicacoes', 'integracoes']) {
      console.log(`Checking ${screen} at ${width}px.`);
      const response = await page.goto(`${base}/demo/${screen}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${screen} returns 200`);
      const csp = response.headers()['content-security-policy'] || '';
      assert.ok(csp.includes("form-action 'none'") && csp.includes("frame-src 'none'"), 'Demo CSP blocks forms and frames');
      assert.equal(new URL(page.url()).pathname, `/demo/${screen}`, 'Demo must not redirect to login');
      await page.locator('main').waitFor();
      await page.getByRole('button', { name: `${width} pixels`, exact: true }).click();
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(overflow.document <= width + 1 && overflow.body <= width + 1, `${screen} horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
      const links = await page.locator('nav a[href^="/demo/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      for (const expected of ['dashboard', 'calendario', 'publicacoes', 'integracoes']) assert.ok(links.includes(`/demo/${expected}`), `Missing navigation ${expected}`);
      await page.screenshot({ path: resolve(output, `${screen}-${width}.png`), fullPage: true });
      report.viewports.push({ width, screen, status: response.status(), overflow });
      if (width === 390) {
        const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        report.accessibility.push({ screen, violations: results.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })) });
      }
      const action = { dashboard: 'Criar publicação', calendario: 'Planejar publicação', publicacoes: 'Nova publicação', integracoes: 'Simular conexão' }[screen];
      await page.getByRole('button', { name: action, exact: true }).first().click();
      await page.getByRole('dialog').waitFor();
      if (screen === 'integracoes') {
        await page.getByRole('button', { name: 'Concluir simulação', exact: true }).click();
      } else {
        await page.getByLabel('Ideia da publicação').fill('Conteúdo fictício para teste local');
        await page.getByRole('button', { name: 'Simular salvar rascunho', exact: true }).click();
      }
      await page.getByRole('status').waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0, 'Demo action closes its dialog');
      await page.getByRole('button', { name: action, exact: true }).first().click();
      await page.getByRole('dialog').waitFor();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      await page.keyboard.press('Shift+Tab');
      assert.ok(await page.getByRole('dialog').evaluate(node => node.contains(document.activeElement)), 'Modal traps reverse tab');
      await page.keyboard.press('Tab');
      assert.ok(await page.getByRole('dialog').evaluate(node => node.contains(document.activeElement)), 'Modal traps tab');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0, 'Escape closes modal');
      assert.ok(await page.getByRole('button', { name: action, exact: true }).first().evaluate(node => node === document.activeElement), 'Modal restores focus');
    }
    // Exercise actual navigation, beyond independently loading every route.
    for (const screen of ['dashboard', 'calendario', 'publicacoes', 'integracoes']) {
      await page.locator(`nav a[href="/demo/${screen}"]`).first().click();
      await page.waitForURL(`${base}/demo/${screen}`);
    }
    await context.close();
  }
  const guardContext = await browser.newContext();
  assert.equal((await guardContext.request.get(`${base}/demo/desconhecida`)).status(), 404, 'Unknown demo route is unavailable');
  assert.equal((await guardContext.request.get(`${base}/demo/dashboard`, { headers: { Host: 'example.invalid' } })).status(), 404, 'Non-loopback host is unavailable');
  await guardContext.close();
  assert.equal(report.blockedRequests.length, 0, 'Demo attempted forbidden requests');
  assert.equal(report.pageErrors.length, 0, 'Demo raised browser errors');
  assert.equal(report.accessibility.flatMap(item => item.violations).length, 0, 'Demo accessibility violations');
  console.log(`PASS: ${report.viewports.length} mobile screen checks, navigation, no external/API requests, no browser errors, accessibility.`);
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
