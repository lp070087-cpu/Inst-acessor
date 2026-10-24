import './db-guard.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { isPublicMediaUrl } from '../src/lib/publishing/media.ts';
import { isPublicAddress } from '../src/lib/publishing/media-reachability.ts';
import { isOwnedUploadPath, ownedBlobPath, mediaSignatureMatches } from '../src/lib/media/upload-policy.ts';
import { isOfficialAdminEmail, authorizedAdminEmails, OFFICIAL_ADMIN_EMAIL } from '../src/lib/auth/admin-access.ts';
import { publishHttp } from '../src/lib/publishing/http.ts';
import { parseAsaasWebhook } from '../src/lib/billing/asaas/webhook.ts';
import { isSameOriginMutation } from '../src/lib/auth/request-origin.ts';
let checks = 0;
const check = (condition) => { assert.ok(condition); checks++; };
for (const url of ['http://example.com/file', 'https://localhost/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://user:password@example.com/a', 'https://a.local/a', 'file:///a', 'https://169.254.169.254/latest']) check(!isPublicMediaUrl(url));
check(isPublicMediaUrl('https://media.public-domain.com/image.jpg'));
for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) check(!isPublicAddress(ip));
check(isPublicAddress('8.8.8.8'));
check(isOwnedUploadPath('inst-acessor/u1/file.jpg', 'u1'));
const blob = 'https://synthetic.public.blob.vercel-storage.com/inst-acessor/u1/a.png';
check(ownedBlobPath(blob, 'u1') === 'inst-acessor/u1/a.png');
check(!ownedBlobPath(blob, 'u2', 'inst-acessor/u2/a.png'));
check(!ownedBlobPath('https://evil.invalid/inst-acessor/u1/a.png', 'u1', 'inst-acessor/u1/a.png'));
check(!ownedBlobPath(blob + '?untrusted=1', 'u1'));
check(!ownedBlobPath(blob, 'u1', 'inst-acessor/u1/another.png'));
check(mediaSignatureMatches(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'));
check(!mediaSignatureMatches(Buffer.from('<script>bad</script>'), 'image/png'));
check(!mediaSignatureMatches(Buffer.from([137,80,78,71,13,10,26,10]), 'image/jpeg'));
check(mediaSignatureMatches(Buffer.from('0000ftypisom'), 'video/mp4'));
check(!mediaSignatureMatches(Buffer.from('0000ftypqt  '), 'video/mp4'));
for (const path of ['inst-acessor/u2/file.jpg', 'inst-acessor/u1/../u2/file.jpg', 'inst-acessor/u1/%2e%2e/a', '/inst-acessor/u1/a', 'inst-acessor/u1//a']) check(!isOwnedUploadPath(path, 'u1'));
process.env.ADMIN_EMAIL = 'admin@audit.invalid';
check(isOfficialAdminEmail(' ADMIN@AUDIT.INVALID '));
check(!isOfficialAdminEmail(OFFICIAL_ADMIN_EMAIL));
check(authorizedAdminEmails().length === 1);
let calls = 0;
globalThis.fetch = async () => { calls++; throw new TypeError('synthetic response lost'); };
await assert.rejects(publishHttp('https://provider.invalid/publish', { method: 'POST' }));
check(calls === 1);
const official = parseAsaasWebhook({ id: 'evt_synthetic_provider_id', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_synthetic', value: 77, paymentDate: '2026-10-17' } });
check(official.eventId === 'evt_synthetic_provider_id');
check(official.paidAt === '2026-10-17');
check(!isSameOriginMutation(new Request('http://127.0.0.1:3107/api/admin/users', { method: 'POST', headers: { origin: 'https://untrusted.invalid' } })));
check(isSameOriginMutation(new Request('http://127.0.0.1:3107/api/admin/users', { method: 'POST', headers: { origin: 'http://127.0.0.1:3107' } })));
{
  // AUTH_URL no domínio técnico não pode bloquear o site oficial (www ou raiz).
  const previous = process.env.AUTH_URL;
  process.env.AUTH_URL = 'https://inst-acessor.vercel.app';
  try {
    check(isSameOriginMutation(new Request('https://www.unitrixapp.com.br/api/onboarding', { method: 'PUT', headers: { origin: 'https://www.unitrixapp.com.br' } })));
    check(isSameOriginMutation(new Request('https://www.unitrixapp.com.br/api/onboarding', { method: 'PUT', headers: { origin: 'https://unitrixapp.com.br' } })));
    check(isSameOriginMutation(new Request('https://www.unitrixapp.com.br/api/onboarding', { method: 'PUT', headers: { origin: 'https://inst-acessor.vercel.app' } })));
    check(!isSameOriginMutation(new Request('https://www.unitrixapp.com.br/api/onboarding', { method: 'PUT', headers: { origin: 'https://unitrixapp.com.br.evil.invalid' } })));
  } finally {
    if (previous === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previous;
  }
}
const handlers = {};
runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
  self: { location: { origin: 'https://local.audit.invalid' }, addEventListener: (name, handler) => { handlers[name] = handler; } }, URL,
});
for (const [path, extra] of [['/api/auth/session', {}], ['/dashboard', { mode: 'navigate', destination: 'document' }], ['/icons/icon-192.svg', { credentials: 'include' }], ['/icons/icon-192.svg', { authorization: true }], ['/private.json', {}]]) {
  let intercepted = false;
  handlers.fetch({ request: { url: 'https://local.audit.invalid' + path, method: 'GET', mode: 'cors', credentials: 'same-origin', headers: { has: () => !!extra.authorization }, ...extra }, respondWith: () => { intercepted = true; } });
  check(!intercepted);
}
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
check(manifest.scope === '/' && manifest.start_url === '/dashboard');
for (const icon of manifest.icons) check(readFileSync(new URL('../public' + icon.src, import.meta.url)).length > 0);
check(readFileSync(new URL('../public/favicon.svg', import.meta.url)).length > 0);
console.log(`${checks} security assertions passed`);
