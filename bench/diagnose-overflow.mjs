import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const base = 'http://127.0.0.1:3107';
  await context.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const csrf = await (await context.request.get(`${base}/api/auth/csrf`)).json();
  await context.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email: 'premium@audit.invalid', password: 'SyntheticAuditOnly123!', callbackUrl: `${base}/dashboard`, json: 'true' } });
  const page = await context.newPage();
  const results = [];
  for (const path of ['/calendario', '/assinatura', '/publishing']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const elements = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.right > innerWidth + 1 && getComputedStyle(node).position !== 'absolute';
    }).map((node) => ({ tag: node.tagName, class: typeof node.className === 'string' ? node.className : '', text: node.textContent?.trim().slice(0, 55), width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right, minWidth: getComputedStyle(node).minWidth, shrink: getComputedStyle(node).flexShrink })).slice(0, 18));
    results.push({ path, actual: page.url(), elements });
  }
  writeFileSync('outputs/verification/overflow-diagnosis.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
