/**
 * Editor de imagem do Preview Social — produção Next real, Postgres descartável,
 * sessão sintética e Blob simulado. O corpo do upload é capturado no navegador
 * (o Playwright não expõe corpos File/Blob), então o JPEG verificado é o arquivo
 * exato que o app enviaria. Nenhuma integração externa é chamada.
 */
import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..');
if (!existsSync(resolve(root, '.next/BUILD_ID'))) throw new Error('Run the production build first');
const output = resolve(root, 'outputs/verification/image-crop'); mkdirSync(output, { recursive: true });
const env = {}; for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME']) if (process.env[key]) env[key] = process.env[key];
const httpPort = 3111;
const dbPort = await new Promise((r, j) => { const s = createServer(); s.once('error', j); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const base = 'http://127.0.0.1:' + httpPort, db = `postgresql://audit:audit@127.0.0.1:${dbPort}/inst_acessor_audit`;
Object.assign(env, { DATABASE_URL: db, DIRECT_URL: db, AUTH_URL: base, NEXTAUTH_URL: base, NEXTAUTH_SECRET: 'crop-synthetic-local-only-2026', ADMIN_EMAIL: 'admin@audit.invalid', TOKEN_ENCRYPTION_KEY: 'crop-synthetic-local-key-2026', NEXT_TELEMETRY_DISABLED: '1', PUBLISHING_WORKER_ENABLED: 'false', NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"` });
for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, env);
const pg = new LocalPostgres(resolve(root, `outputs/crop-postgres-${Date.now()}`), dbPort);
const results = []; let server, browser, prisma, serverLog = '', checks = 0;
const run = async args => { const p = spawn(process.execPath, args, { cwd: root, env }); let t = ''; p.stdout.on('data', b => t += b); p.stderr.on('data', b => t += b); const code = await new Promise(r => p.once('close', r)); if (code) throw new Error(t.slice(-3000)); return t; };
const check = (cond, label) => { if (!cond) throw new Error('FAILED: ' + label); checks++; console.log('ok ' + label); };

try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('inst_acessor_audit');
  const sql = await run([resolve(require.resolve('prisma/package.json'), '../build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
  const c = new Client({ connectionString: db }); await c.connect(); try { await c.query(sql); } finally { await c.end(); }
  const { PrismaClient } = require('@prisma/client'); prisma = new PrismaClient();
  const user = await prisma.user.create({ data: { email: 'admin@audit.invalid', name: 'Editor fictício', role: 'ADMIN', passwordHash: 'synthetic-not-a-login-password', firstAccessCompleted: true, emailVerified: new Date() } });
  await prisma.userProfile.create({ data: { userId: user.id, onboardingCompleted: true } });
  const { encode } = require('next-auth/jwt');
  const token = await encode({ secret: env.NEXTAUTH_SECRET, token: { id: user.id, email: user.email, role: 'ADMIN', authVersion: createHash('sha256').update(user.passwordHash).digest('hex') }, maxAge: 3600 });
  server = spawn(process.execPath, [resolve(require.resolve('next/package.json'), '../dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(httpPort)], { cwd: root, env: { ...env, NODE_ENV: 'production' } });
  server.stdout.on('data', b => serverLog += b); server.stderr.on('data', b => serverLog += b);
  for (let i = 0; i < 90 && !serverLog.includes('Ready'); i++) await new Promise(r => setTimeout(r, 1000));
  if (!serverLog.includes('Ready')) throw new Error('server not ready');
  const { chromium, expect: baseExpect } = await import('@playwright/test'); const expect = baseExpect.configure({ timeout: 20000 });
  browser = await chromium.launch({ headless: true });

  // Fixtures com quatro quadrantes de cor conhecida: vermelho, verde, azul, amarelo.
  const fixturePage = await browser.newPage();
  const fixtures = await fixturePage.evaluate(async () => {
    const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#e11d48'; x.fillRect(0, 0, w / 2, h / 2); x.fillStyle = '#16a34a'; x.fillRect(w / 2, 0, w / 2, h / 2);
      x.fillStyle = '#2563eb'; x.fillRect(0, h / 2, w / 2, h / 2); x.fillStyle = '#facc15'; x.fillRect(w / 2, h / 2, w / 2, h / 2);
      x.fillStyle = '#fff'; x.font = `bold ${Math.round(Math.min(w, h) / 10)}px sans-serif`; x.textAlign = 'center'; x.fillText('Inst Acessor', w / 2, h / 2);
      return c.toDataURL('image/png').split(',')[1]; };
    return { horizontal: make(1600, 1000), vertical: make(1000, 1600), square: make(1200, 1200) };
  });
  await fixturePage.close();

  for (const [width, height] of [[375, 667], [390, 844], [430, 932], [1440, 900]]) {
    const mobile = width < 600;
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    await ctx.addCookies([{ name: 'next-auth.session-token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
    const files = new Map(), uploads = [], errors = [];
    await ctx.exposeBinding('__captureUpload', (_, url, b64) => { const u = new URL(url); const pathname = u.searchParams.get('pathname') || decodeURIComponent(u.pathname.slice(1)); const bytes = Buffer.from(b64, 'base64'); files.set(pathname, bytes); uploads.push({ pathname, bytes }); });
    await ctx.addInitScript(() => {
      const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__u = String(url); this.__m = method; return open.call(this, method, url, ...rest); };
      XMLHttpRequest.prototype.send = function (body) {
        if (this.__m === 'PUT' && this.__u.includes('vercel.com/api/blob') && body instanceof Blob) {
          const r = new FileReader(); r.onload = () => window.__captureUpload(this.__u, String(r.result).split(',')[1]).then(() => send.call(this, body)); r.readAsDataURL(body); return;
        }
        return send.call(this, body);
      };
      const f = window.fetch;
      window.fetch = async (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (init?.method === 'PUT' && url.includes('vercel.com/api/blob') && init.body) {
          // O SDK pode enviar Blob ou ReadableStream; materializa para capturar os bytes exatos.
          const blob = init.body instanceof Blob ? init.body : await new Response(init.body).blob();
          const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
          await window.__captureUpload(url, btoa(s));
          const { duplex, ...rest } = init; return f(input, { ...rest, body: blob });
        }
        return f(input, init);
      };
    });
    const payload = Buffer.from(JSON.stringify({ allowedContentTypes: ['image/jpeg', 'image/png'], maximumSizeInBytes: 104857600, validUntil: Date.now() + 3600000, addRandomSuffix: false })).toString('base64');
    const clientToken = 'vercel_blob_client_crop_' + Buffer.from('synthetic-signature.' + payload).toString('base64');
    await ctx.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === base && url.pathname === '/api/upload/media') return route.fulfill({ json: { type: 'blob.generate-client-token', clientToken } });
      if (url.origin === base && url.pathname === '/api/media-library' && req.method() === 'POST') return route.fulfill({ json: { ok: true } });
      if (url.origin === base) return route.continue();
      if (req.method() === 'OPTIONS' && url.hostname === 'vercel.com') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-methods': 'PUT,GET,OPTIONS', 'access-control-allow-headers': '*' } });
      if (req.method() === 'PUT' && url.hostname === 'vercel.com' && url.pathname === '/api/blob/') { const pathname = url.searchParams.get('pathname'); return route.fulfill({ headers: { 'access-control-allow-origin': base }, json: { url: `https://fixture.public.blob.vercel-storage.com/${pathname}`, downloadUrl: `https://fixture.public.blob.vercel-storage.com/${pathname}`, pathname, contentType: pathname.endsWith('.png') ? 'image/png' : 'image/jpeg', contentDisposition: 'inline', etag: 'fixture' } }); }
      if (url.hostname === 'fixture.public.blob.vercel-storage.com') { const body = files.get(decodeURIComponent(url.pathname.slice(1))); return body ? route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: url.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg', body }) : route.fulfill({ status: 404, body: '' }); }
      return route.abort();
    });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/preview-social', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Post', exact: true }).click();

    for (const [kind, b64] of Object.entries(fixtures)) {
      const tag = `${kind}-${width}`;
      await page.getByRole('button', { name: 'Limpar', exact: true }).click();
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      await page.locator('input[type=file]').first().setInputFiles({ name: `${kind}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await page.getByRole('button', { name: 'Editar imagem' }).click();
      const dialog = page.getByRole('dialog', { name: 'Editar imagem' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/JPEG \d+ × \d+px/)).toBeVisible();
      // Proporções do feed: 9:16 fica indisponível para Post.
      await expect(dialog.getByRole('radio', { name: '9:16' })).toBeDisabled();
      // Cancelar descarta: o zoom alterado não chega ao conteúdo.
      await dialog.getByRole('button', { name: 'Aumentar zoom' }).click();
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole('button', { name: 'Editar imagem' }).click();
      check(Number(await dialog.getByLabel('Zoom', { exact: true }).inputValue()) === 1, `${tag}: cancel discards the edit`);

      // Recorte analítico: 1:1, girar 90° no sentido horário, sem zoom.
      await dialog.getByRole('radio', { name: '1:1' }).click();
      await dialog.getByRole('button', { name: 'Girar 90° à direita' }).click();
      await expect(dialog.getByText(/JPEG \d+ × \d+px/)).toBeVisible();
      const sizeText = await dialog.getByText(/JPEG \d+ × \d+px/).innerText();
      await page.screenshot({ path: resolve(output, `editor-${tag}.png`) });
      await dialog.getByRole('button', { name: 'Aplicar' }).click();
      await expect(dialog).toBeHidden();
      await page.locator('textarea').first().fill(`Teste de recorte ${tag}`);
      const before = uploads.length;
      const saved = page.waitForResponse(r => r.url().includes('/api/drafts') && r.request().method() === 'POST');
      await page.getByRole('button', { name: /Salvar rascunho/ }).click();
      const response = await saved; check(response.status() === 200, `${tag}: draft saved`);
      const { draft } = await response.json(); const project = JSON.parse(draft.framing);
      const exported = uploads.slice(before).find(u => u.pathname.endsWith('.jpg'));
      if (!exported) console.log('UPLOADS', JSON.stringify(uploads.map(u => [u.pathname, u.bytes.length, u.bytes.subarray(0, 4).toString('hex')])), JSON.stringify(project.slides));
      check(!!exported && exported.bytes.subarray(0, 3).toString('hex') === 'ffd8ff', `${tag}: exported file is a real JPEG captured from the upload`);
      check(project.aspectRatio === '1:1' && project.slides[0].rotation === 90 && project.slides[0].exportedUrl, `${tag}: crop, rotation and exported file persisted in the draft`);
      // Decodifica o JPEG e confere as cores esperadas por geometria (rotação horária).
      const probe = await page.evaluate(async b64 => {
        const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
        const at = (fx, fy) => Array.from(x.getImageData(Math.round(bmp.width * fx), Math.round(bmp.height * fy), 1, 1).data.slice(0, 3));
        return { width: bmp.width, height: bmp.height, tl: at(0.12, 0.12), tr: at(0.88, 0.12), bl: at(0.12, 0.88), br: at(0.88, 0.88) };
      }, exported.bytes.toString('base64'));
      const near = (rgb, hex) => { const t = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return rgb.every((v, i) => Math.abs(v - t[i]) < 40); };
      check(probe.width === probe.height, `${tag}: exported file is exactly 1:1 (${probe.width}×${probe.height})`);
      check(sizeText.includes(`${probe.width} × ${probe.height}px`), `${tag}: exported size matches the size announced in the editor`);
      check(near(probe.tl, '#2563eb') && near(probe.tr, '#e11d48') && near(probe.br, '#16a34a') && near(probe.bl, '#facc15'), `${tag}: exported pixels match the 90° clockwise crop`);
      const nativeSide = kind === 'square' ? 1200 : 1000;
      check(probe.width === nativeSide, `${tag}: native resolution preserved (${probe.width}px, no upscaling)`);
      results.push({ tag, size: `${probe.width}x${probe.height}`, colors: probe });
      writeFileSync(resolve(output, `exported-${tag}.jpg`), exported.bytes);
    }

    // Gestos e reabertura com a imagem horizontal: zoom, pinça, arraste, livre e original.
    const tag = `gestures-${width}`;
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await page.locator('input[type=file]').first().setInputFiles({ name: 'horizontal.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.horizontal, 'base64') });
    await page.getByRole('button', { name: 'Editar imagem' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar imagem' });
    await dialog.getByRole('radio', { name: 'Original' }).click();
    const stage = dialog.getByTestId('crop-stage');
    const stageRatio = () => stage.evaluate(el => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    await expect.poll(stageRatio).toBeGreaterThan(1.57);
    const ratioOriginal = await stageRatio();
    check(Math.abs(ratioOriginal - 1.6) < 0.03, `${tag}: Original keeps the photo's 1.6 aspect (${ratioOriginal.toFixed(3)})`);
    // Pinça com dois ponteiros sintéticos.
    const box = await stage.boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await stage.evaluate((el, { cx, cy }) => {
      const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
      fire('pointerdown', 1, cx - 20, cy); fire('pointerdown', 2, cx + 20, cy);
      fire('pointermove', 1, cx - 50, cy); fire('pointermove', 2, cx + 50, cy);
      fire('pointerup', 1, cx - 50, cy); fire('pointerup', 2, cx + 50, cy);
    }, { cx, cy });
    const pinched = Number(await dialog.getByLabel('Zoom', { exact: true }).inputValue());
    check(pinched > 2.3 && pinched < 2.7, `${tag}: pinch gesture zooms (×${pinched.toFixed(2)})`);
    // Arraste com o mouse/dedo.
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy + 10, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(150);
    const resultCanvas = dialog.getByTestId('crop-result');
    const previewPixels = await resultCanvas.evaluate(c => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
    const previewSize = await resultCanvas.evaluate(c => [c.width, c.height]);
    await page.screenshot({ path: resolve(output, `editor-${tag}.png`) });
    await dialog.getByRole('button', { name: 'Aplicar' }).click();
    await page.locator('textarea').first().fill(`Teste de gestos ${tag}`);
    const before = uploads.length;
    const saved = page.waitForResponse(r => r.url().includes('/api/drafts') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Salvar rascunho/ }).click();
    const { draft } = await (await saved).json(); const project = JSON.parse(draft.framing);
    check(project.aspectRatio === 'original' && Math.abs(project.aspectValue - 1.6) < 0.01 && project.slides[0].framing.zoom > 2.3, `${tag}: original ratio, numeric aspect and zoom persisted`);
    // O arquivo exportado corresponde à prévia do arquivo final mostrada no editor.
    const exported = uploads.slice(before).find(u => u.pathname.endsWith('.jpg'));
    const diff = await page.evaluate(async ({ b64, preview, size }) => {
      const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
      const c = document.createElement('canvas'); [c.width, c.height] = size; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += Math.abs(d[i] - preview[i]) + Math.abs(d[i + 1] - preview[i + 1]) + Math.abs(d[i + 2] - preview[i + 2]);
      return { mean: sum / (d.length / 4) / 3, w: bmp.width, h: bmp.height };
    }, { b64: exported.bytes.toString('base64'), preview: previewPixels, size: previewSize });
    check(diff.mean < 6, `${tag}: exported ${diff.w}×${diff.h} JPEG matches the approved preview (mean pixel diff ${diff.mean.toFixed(2)})`);
    writeFileSync(resolve(output, `exported-${tag}.jpg`), exported.bytes);
    // Reabrir o rascunho restaura o enquadramento.
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /Rascunhos/ }).click();
    await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
    await page.getByRole('button', { name: 'Editar imagem' }).click();
    await expect(dialog.getByRole('radio', { name: 'Original' })).toHaveAttribute('aria-checked', 'true');
    const reopenedZoom = Number(await dialog.getByLabel('Zoom', { exact: true }).inputValue());
    check(Math.abs(reopenedZoom - project.slides[0].framing.zoom) < 0.01, `${tag}: reopened draft restores zoom ×${reopenedZoom.toFixed(2)}`);
    // Livre: a alça muda a proporção dentro do limite do feed.
    await dialog.getByRole('radio', { name: 'Livre' }).click();
    const handle = dialog.getByRole('button', { name: 'Redimensionar recorte livre' }); const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x - 60, hb.y + 200, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const freeRatio = await stageRatio();
    check(freeRatio >= 0.79 && freeRatio <= 1.92 && Math.abs(freeRatio - 1.6) > 0.05, `${tag}: free crop changes the aspect within 4:5–1.91:1 (${freeRatio.toFixed(3)})`);
    await dialog.getByRole('button', { name: 'Redefinir' }).click();
    check(Number(await dialog.getByLabel('Zoom', { exact: true }).inputValue()) === 1, `${tag}: reset restores neutral framing`);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    // Card do celular depois de reabrir: sem rolagem lateral, imagem visível.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!overflow, `${tag}: no horizontal scroll`);
    await page.getByText('Pré-visualização').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `card-${tag}.png`) });
    check(errors.length === 0, `${tag}: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, results, scope: 'Real production UI and browser canvas export; Blob storage mocked, upload bytes captured from the browser' }, null, 2));
  console.log(`${checks} image crop UI assertions passed`);
} finally {
  try { await browser?.close(); } catch {}
  try { await prisma?.$disconnect(); } catch {}
  try { server?.kill(); } catch {}
  writeFileSync(resolve(output, 'server.log'), serverLog);
  await pg.stop();
}
