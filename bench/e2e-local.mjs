import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const edge = process.env.AUDIT_BROWSER === 'edge';
const focused = process.env.AUDIT_E2E_SCOPE === 'regression';
const growthOnly = process.env.AUDIT_E2E_SCOPE === 'growth';
const label = edge ? '-edge' : growthOnly ? '-growth' : focused ? '-regression' : '';
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || target.pathname !== '/inst_acessor_audit') throw new Error('Local audit database required');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const password = 'SyntheticAuditOnly123!';
const passwordHash = await bcrypt.hash(password, 12);
for (const name of ['free', 'premium', 'expired', 'suspended', 'password-reset', 'admin']) {
  const email = `${name}@audit.invalid`;
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: `${name} de teste`, passwordHash, firstAccessCompleted: true, emailVerified: new Date(), role: name === 'admin' ? 'ADMIN' : 'USER' }, update: { passwordHash, firstAccessCompleted: true, emailVerified: new Date(), role: name === 'admin' ? 'ADMIN' : 'USER' } });
  await prisma.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, onboardingCompleted: true }, update: { onboardingCompleted: true } });
  if (name === 'expired') await prisma.accessGrant.create({ data: { email, userId: user.id, origin: 'ADMIN_MANUAL', status: 'EXPIRED', startAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
}
const screenshots = resolve(root, 'outputs/screenshots', edge ? 'edge' : growthOnly ? 'growth' : focused ? 'regression' : '.');
mkdirSync(screenshots, { recursive: true });
// Refuse to sign into any server already using the audit HTTP port.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(3107, '127.0.0.1', () => probe.close(resolve));
});
const server = spawn(process.execPath, [resolve(require.resolve('next/package.json'), '..', 'dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3107'], { cwd: root, env: { ...process.env, NODE_ENV: 'production' }, windowsHide: true });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });
const findings = [];
const accessibility = [];
const consoleMessages = [];
const networkErrors = [];
function observe(page, errors) {
  page.on('pageerror', (error) => errors.push({ url: page.url(), message: error.message }));
  page.on('console', (message) => {
    if (['error','warning'].includes(message.type())) consoleMessages.push({ path: new URL(page.url()).pathname, type: message.type(), text: message.text().slice(0, 1000) });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
}
async function overflowElements(page) {
  return page.evaluate(() => [...document.querySelectorAll('main *')].filter((node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.right > innerWidth + 1 && getComputedStyle(node).position !== 'absolute';
  }).map((node) => ({ tag: node.tagName, class: typeof node.className === 'string' ? node.className : '', text: node.textContent?.trim().slice(0, 45), width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right })).slice(0, 12));
}
const checkpoint = () => writeFileSync(resolve(root, `outputs/verification/e2e${label}-progress.json`), JSON.stringify({ findings, accessibility }, null, 2));
let browser;
const base = 'http://127.0.0.1:3107';
function routeLocal(route) {
  const url = new URL(route.request().url());
  if (url.origin === base) return route.continue();
  if (url.hostname === 'synthetic.public.blob.vercel-storage.com' && url.pathname.startsWith('/inst-acessor/')) {
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64') });
  }
  return route.abort();
}
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server stopped: ${serverLog}`);
    try { if (serverLog.includes('Ready') && (await fetch(`${base}/login`)).ok && server.exitCode === null) break; } catch { /* wait for own server */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ headless: true, ...(edge ? { channel: 'msedge' } : {}) });
  console.log(`Browser: ${edge ? 'Edge' : 'Chromium'} ${browser.version()}`);
  const publicContext = await browser.newContext();
  await publicContext.route('**/*', routeLocal);
  const page = await publicContext.newPage();
  const errors = [];
  observe(page, errors);
  const registration = { name: 'Cadastro fictício', email: 'registered@audit.invalid', password, confirmPassword: password };
  const registered = await publicContext.request.post(`${base}/api/auth/register`, { data: registration });
  findings.push({ interaction: 'register-synthetic-user', status: registered.status(), expected: 201 });
  const duplicate = await publicContext.request.post(`${base}/api/auth/register`, { data: registration });
  findings.push({ interaction: 'register-duplicate', status: duplicate.status(), expected: 409 });
  const onboardingContext = await browser.newContext();
  await onboardingContext.route('**/*', routeLocal);
  const onboardingCsrf = await (await onboardingContext.request.get(`${base}/api/auth/csrf`)).json();
  await onboardingContext.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: onboardingCsrf.csrfToken, email: registration.email, password, callbackUrl: `${base}/onboarding`, json: 'true' } });
  const onboarding = await onboardingContext.request.put(`${base}/api/onboarding`, { data: {} });
  findings.push({ interaction: 'onboarding-optional-fields', status: onboarding.status(), expected: 200 });
  const registeredUser = await prisma.user.findUnique({ where: { email: registration.email }, include: { profile: true } });
  findings.push({ interaction: 'onboarding-persisted', passed: !!registeredUser?.profile?.onboardingCompleted });
  await onboardingContext.close();
  const sizes = growthOnly ? [[1440,900],[390,844]] : edge || focused ? [[1440,900],[390,844],[320,568]] : [[1280,720],[1440,900],[1920,1080],[320,568],[360,800],[375,667],[390,844],[412,915],[430,932],[568,320],[800,360],[844,390],[915,412],[768,1024],[1024,768]];
  for (const [width, height] of growthOnly ? [] : sizes) {
    const viewportContext = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    await viewportContext.route('**/*', routeLocal);
    const page = await viewportContext.newPage();
    observe(page, errors);
    for (const path of ['/', '/login', '/checkout?plano=mensal']) {
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const name = path === '/' ? 'landing' : path.startsWith('/login') ? 'login' : 'checkout';
      await page.screenshot({ path: resolve(screenshots, `${name}-${width}x${height}.png`), fullPage: true });
      findings.push({ path, width, height, status: response.status(), overflow, offenders: overflow ? await overflowElements(page) : [] });
      if (width === 390 || width === 1440) {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        accessibility.push({ path, width, violations: result.violations });
      }
    }
    await viewportContext.close();
    checkpoint();
    console.log(`Public viewport ${width}x${height} captured`);
  }
  for (const name of growthOnly ? ['premium'] : ['free', 'premium', 'expired', 'suspended', 'password-reset', 'admin']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    await context.route('**/*', routeLocal);
    const csrf = await (await context.request.get(`${base}/api/auth/csrf`)).json();
    const signedIn = await context.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email: `${name}@audit.invalid`, password, callbackUrl: `${base}/dashboard`, json: 'true' } });
    if (!signedIn.ok()) throw new Error(`Synthetic local sign-in failed: ${name}`);
    const user = await prisma.user.findUnique({ where: { email: `${name}@audit.invalid` } });
    if (name === 'suspended') await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    if (name === 'password-reset') await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash('ChangedSyntheticAuditOnly123!', 12) } });
    const protectedResponse = await context.request.get(`${base}/api/ai/conversations`);
    findings.push({ identity: name, api: '/api/ai/conversations', status: protectedResponse.status(), expected: ['suspended','password-reset'].includes(name) ? 401 : ['premium','admin'].includes(name) ? 200 : 403 });
    const adminResponse = await context.request.get(`${base}/api/admin/users`, { maxRedirects: 0 });
    findings.push({ identity: name, api: '/api/admin/users', status: adminResponse.status(), expected: name === 'admin' ? 200 : ['suspended','password-reset'].includes(name) ? 401 : 403 });
    for (const api of ['/api/ideas','/api/mentoria','/api/media-library','/api/publishing']) {
      const response = await context.request.get(base + api);
      findings.push({ identity: name, api, status: response.status(), expected: ['suspended','password-reset'].includes(name) ? 401 : ['premium','admin'].includes(name) ? 200 : 403 });
    }
    if (name === 'free') {
      for (const api of ['/api/rank','/api/growth/engine']) {
        const response = await context.request.get(base + api);
        findings.push({ identity: name, api, status: response.status(), expected: 200 });
      }
    }
    if (name === 'free') {
      const payload = { platform: 'instagram', mediaType: 'image', caption: 'Rascunho fictício da bancada', format: 'post' };
      const created = await context.request.post(`${base}/api/drafts`, { data: payload });
      findings.push({ identity: name, interaction: 'draft-create', status: created.status(), expected: 200 });
      const draft = (await created.json()).draft;
      if (!draft?.id) throw new Error('Synthetic draft creation did not return an ID');
      const updated = await context.request.patch(`${base}/api/drafts?id=${draft.id}`, { data: { ...payload, caption: 'Atualizado localmente' } });
      findings.push({ identity: name, interaction: 'draft-update', status: updated.status(), expected: 200 });
      const foreign = await prisma.socialDraft.create({ data: { userId: (await prisma.user.findUnique({ where: { email: 'other@audit.invalid' } })).id, platform: 'instagram', caption: 'Private synthetic draft' } });
      const rejected = await context.request.delete(`${base}/api/drafts?id=${foreign.id}`);
      findings.push({ identity: name, interaction: 'draft-cross-owner-denied', status: rejected.status(), expected: 404 });
      const deleted = await context.request.delete(`${base}/api/drafts?id=${draft.id}`);
      findings.push({ identity: name, interaction: 'draft-delete', status: deleted.status(), expected: 200 });
      const csrfDenied = await context.request.post(`${base}/api/drafts`, { headers: { origin: 'https://untrusted.invalid' }, data: payload });
      findings.push({ identity: name, interaction: 'draft-cross-origin-denied', status: csrfDenied.status(), expected: 403 });
      const forged = await context.request.post(`${base}/api/media-library`, { data: { url: 'https://untrusted.invalid/image.png', pathname: `inst-acessor/${user.id}/image.png` } });
      findings.push({ identity: name, interaction: 'free-media-registration-denied', status: forged.status(), expected: 403 });
    }
    if (name === 'premium' || name === 'admin') {
      const memberPage = await context.newPage();
      observe(memberPage, errors);
      for (const [width, height] of name === 'premium' ? sizes : [[1440,900],[390,844]]) {
        await memberPage.setViewportSize({ width, height });
        const extraPages = !growthOnly && name === 'premium' && [1440, 390].includes(width) ? focused || edge ? ['/rank','/growth','/gerador-de-copy','/ideias','/mentoria'] : ['/score','/rank','/growth','/gerador-de-copy','/ideias','/mentoria','/perfil-de-inteligencia','/preview-social','/automacoes','/analise-de-desempenho','/redes-sociais','/configuracoes','/perfil','/sobre','/calendario-inteligente'] : [];
        for (const path of growthOnly ? ['/growth'] : ['/dashboard','/calendario','/biblioteca-de-midia','/ia-acessor','/respostas-inteligentes','/assinatura','/publishing', ...extraPages, ...(name === 'admin' ? ['/admin','/admin/pre-lancamento'] : [])]) {
        const response = await memberPage.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        const overflow = await memberPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        await memberPage.screenshot({ path: resolve(screenshots, `${name}-${path.slice(1)}-${width}x${height}.png`), fullPage: true });
        findings.push({ identity: name, path, expectedPath: path === '/gerador-de-copy' ? '/preview-social' : path, width, height, status: response.status(), overflow, offenders: overflow ? await overflowElements(memberPage) : [], actualPath: new URL(memberPage.url()).pathname });
        if (name === 'premium' && (width === 390 || width === 1440)) {
          const result = await new AxeBuilder({ page: memberPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          accessibility.push({ identity: name, path, width, violations: result.violations });
        }
        if (path === '/dashboard' && width === 390) {
          await memberPage.getByRole('button', { name: 'Abrir menu' }).click();
          const drawer = memberPage.getByRole('dialog', { name: 'Menu de navegação' });
          await drawer.waitFor({ state: 'visible' });
          await memberPage.keyboard.press('Shift+Tab');
          findings.push({ identity: name, interaction: 'drawer-focus-trap', passed: await drawer.evaluate((node) => node.contains(document.activeElement)) });
          await memberPage.keyboard.press('Escape');
          findings.push({ identity: name, interaction: 'drawer-escape', passed: await drawer.count() === 0 });
        }
        if (path === '/calendario' && width === 390 && name === 'premium') {
          await memberPage.getByRole('button', { name: 'Novo conteúdo', exact: true }).first().click();
          const dialog = memberPage.getByRole('dialog', { name: 'Novo conteúdo planejado' });
          await dialog.waitFor({ state: 'visible' });
          await memberPage.keyboard.press('Shift+Tab');
          findings.push({ identity: name, interaction: 'calendar-dialog-focus', passed: await dialog.evaluate((node) => node.contains(document.activeElement)) });
          await memberPage.screenshot({ path: resolve(screenshots, 'calendar-dialog-390x844.png'), fullPage: true });
          await memberPage.keyboard.press('Escape');
          findings.push({ identity: name, interaction: 'calendar-dialog-escape', passed: await dialog.count() === 0 });
          const before = errors.length;
          for (let repeat = 0; repeat < 3; repeat++) await memberPage.goto(`${base}/calendario`, { waitUntil: 'networkidle' });
          findings.push({ identity: name, interaction: 'calendar-repeated-hydration', passed: errors.length === before });
        }
        }
        if (name === 'premium' && width === 1440) {
          await memberPage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
          await memberPage.evaluate(() => { document.documentElement.style.zoom = '2'; });
          findings.push({ identity: name, interaction: 'css-zoom-200-reflow', passed: await memberPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) });
          await memberPage.screenshot({ path: resolve(screenshots, 'dashboard-css-zoom-200.png'), fullPage: true });
          await memberPage.evaluate(() => { document.documentElement.style.zoom = ''; });
        }
        checkpoint();
        console.log(`${name} viewport ${width}x${height} captured`);
      }
    }
    await context.close();
  }
  const unauth = await publicContext.request.get(`${base}/api/ai/conversations`);
  findings.push({ identity: 'anonymous', api: '/api/ai/conversations', status: unauth.status(), expected: 401 });
  const unsigned = await publicContext.request.post(`${base}/api/webhooks/publishing`, { data: { eventId: 'synthetic' } });
  findings.push({ api: '/api/webhooks/publishing', status: unsigned.status(), expected: 503 });
  const cron = await publicContext.request.get(`${base}/api/cron/publishing`);
  findings.push({ api: '/api/cron/publishing', status: cron.status(), expected: 503 });
  const failures = findings.filter((finding) => finding.overflow || finding.passed === false || (finding.actualPath && finding.actualPath !== (finding.expectedPath ?? finding.path)) || (finding.expected !== undefined && finding.status !== finding.expected) || finding.status >= 500 && finding.expected !== 503);
  writeFileSync(resolve(root, `outputs/verification/e2e${label}-results.json`), JSON.stringify({ browser: browser.version(), findings, accessibility, pageErrors: errors, consoleMessages, networkErrors, failures }, null, 2));
  const serious = accessibility.flatMap((entry) => entry.violations).filter((violation) => ['serious','critical'].includes(violation.impact));
  console.log(`${findings.length} local observations; ${failures.length} failures; ${errors.length} page errors`);
  if (failures.length || errors.length || serious.length || networkErrors.length || /prisma:error/.test(serverLog)) throw new Error('E2E/accessibility/server assertions failed; inspect recorded evidence');
} finally {
  await browser?.close();
  server.kill();
  writeFileSync(resolve(root, `outputs/verification/e2e${label}-server.log`), serverLog);
  await prisma.$disconnect();
}
