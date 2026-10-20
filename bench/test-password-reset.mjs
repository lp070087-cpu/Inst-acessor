import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

// Must run in the driver's freshly created loopback-only cluster, never standalone
// with inherited database or provider configuration. No provider call is made.
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.ok(process.env.AUDIT_DATABASE_PORT);
assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
assert.equal(target.pathname, '/inst_acessor_audit');
process.env.NODE_ENV = 'test';
process.env.AUTH_URL = 'http://127.0.0.1:3107';
process.env.EMAIL_PROVIDER = 'none';
process.env.EMAIL_FROM = 'Password reset fixture <reset@audit.invalid>';
process.env.RESEND_API_KEY = 'synthetic-mail-key-never-real';
delete process.env.VERCEL_ENV;
const { prisma } = await import('../src/lib/db.ts');
const { hashPassword, verifyPassword } = await import('../src/lib/auth/password.ts');
const { authOptions } = await import('../src/lib/auth/config.ts');
const { PASSWORD_RESET_TTL_MS, PASSWORD_RESET_REQUEST_MESSAGE, passwordResetOrigin } = await import('../src/lib/auth/password-reset.ts');
const { POST: requestReset } = await import('../src/app/api/password-reset/request/route.ts');
const { POST: completeReset } = await import('../src/app/api/password-reset/complete/route.ts');
const digest = value => createHash('sha256').update(value).digest('hex');
const originalFetch = globalThis.fetch, mail = [];
let mailStatus = 200, nextIp = 10, checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`ok ${label}`); };
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), 'https://api.resend.com/emails');
  assert.equal(init.redirect, 'error');
  const body = JSON.parse(init.body);
  const link = body.text.match(/http:\/\/127\.0\.0\.1:3107\/recuperar-senha#token=[a-f0-9]{64}/)?.[0];
  assert.ok(link, 'Recovery template must use a fragment, never a query token');
  mail.push({ to: body.to[0], link });
  return new Response(JSON.stringify({ id: 'synthetic-email' }), { status: mailStatus });
};
const makeRequest = (path, body, ip, origin = process.env.AUTH_URL) => new Request(`${process.env.AUTH_URL}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ip }, body: JSON.stringify(body),
});
const request = (email, ip = `198.51.100.${nextIp++}`) => requestReset(makeRequest('/api/password-reset/request', { email }, ip));
const complete = (token, password = 'NewSyntheticPassword123!', ip = '203.0.113.10') => completeReset(makeRequest('/api/password-reset/complete', { token, password }, ip));
const tokenFromMail = entry => new URLSearchParams(new URL(entry.link).hash.slice(1)).get('token');
const resetRows = () => prisma.verificationToken.count({ where: { identifier: { startsWith: 'password-reset:' } } });
const suffix = randomUUID(), originalPassword = 'OriginalSyntheticPassword123!';
const originalHash = await hashPassword(originalPassword);
const account = async (label, status = 'ACTIVE') => prisma.user.create({ data: {
  email: `${label}-${suffix}@audit.invalid`, status, passwordHash: originalHash, firstAccessCompleted: true, emailVerified: new Date(),
} });
try {
  const user = await account('reset-active'), suspended = await account('reset-suspended', 'SUSPENDED');
  const off = await request(user.email);
  check(off.status === 200 && (await off.json()).message === PASSWORD_RESET_REQUEST_MESSAGE, 'Disabled email returns the generic conditional message');
  check(mail.length === 0 && await resetRows() === 0, 'Disabled email creates no recovery token and claims no delivery');
  process.env.EMAIL_PROVIDER = 'resend';
  const unknown = await request(`unknown-${suffix}@audit.invalid`), inactive = await request(suspended.email);
  check(unknown.status === 200 && inactive.status === 200, 'Unknown and inactive accounts share HTTP status');
  assert.deepEqual(await unknown.json(), await inactive.json()); checks++;
  check(mail.length === 0, 'Unknown and inactive accounts never trigger email');
  const accepted = await request(user.email), acceptedBody = await accepted.json();
  check(accepted.status === 200 && acceptedBody.message === PASSWORD_RESET_REQUEST_MESSAGE, 'Active account also returns the same generic response');
  check(mail.length === 1, 'Configured recovery calls the actual email template through mocked transport');
  const raw = tokenFromMail(mail[0]), stored = await prisma.verificationToken.findUnique({ where: { token: digest(raw) } });
  check(/^[a-f0-9]{64}$/.test(raw), 'Recovery token has 256 random bits');
  check(stored && stored.token !== raw && !JSON.stringify(stored).includes(raw), 'Database stores only a token hash');
  check(stored.identifier.endsWith(digest(originalHash)), 'Recovery token is bound to the current password version');
  check(stored.expires > new Date() && stored.expires.getTime() <= Date.now() + PASSWORD_RESET_TTL_MS, 'Recovery link expires within fifteen minutes');
  check(!JSON.stringify(acceptedBody).includes(raw) && Object.keys(acceptedBody).sort().join(',') === 'message,ok', 'HTTP response never returns a recovery token');
  check(new URL(mail[0].link).search === '' && new URL(mail[0].link).hash.startsWith('#token='), 'Email link carries its secret only in a browser fragment');
  check((await complete(raw, 'short')).status === 400, 'Existing password policy rejects a short password');
  check(!!await prisma.verificationToken.findUnique({ where: { token: digest(raw) } }), 'Rejected password does not consume the link');
  const race = await Promise.all(Array.from({ length: 4 }, () => complete(raw)));
  check(race.filter(response => response.status === 200).length === 1, 'Four concurrent completions consume the token exactly once');
  check(race.filter(response => response.status === 400).length === 3, 'Concurrent replays fail generically');
  check((await complete(raw)).status === 400, 'Consumed token cannot be replayed');
  const changed = await prisma.user.findUnique({ where: { id: user.id } });
  check(await verifyPassword('NewSyntheticPassword123!', changed.passwordHash), 'Successful completion persists a real bcrypt password');
  const jwt = await authOptions.callbacks.jwt({ token: { id: user.id, authVersion: digest(originalHash), role: 'USER' } });
  check(jwt.revoked && !jwt.id, 'Existing real JWT callback revokes the old password session');

  await request(user.email);
  const oldVersionToken = tokenFromMail(mail.at(-1));
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: originalHash } });
  check((await complete(oldVersionToken)).status === 400, 'Independent password change invalidates an outstanding link');

  const expiredUser = await account('reset-expired'); await request(expiredUser.email);
  const expired = tokenFromMail(mail.at(-1));
  await prisma.verificationToken.update({ where: { token: digest(expired) }, data: { expires: new Date(Date.now() - 1000) } });
  check((await complete(expired)).status === 400, 'Expired recovery link is refused');
  const suspendLater = await account('reset-suspend-later'); await request(suspendLater.email);
  const suspendedToken = tokenFromMail(mail.at(-1));
  await prisma.user.update({ where: { id: suspendLater.id }, data: { status: 'SUSPENDED' } });
  check((await complete(suspendedToken)).status === 400, 'Suspension after issuance also prevents password reset');

  const rollbackUser = await account('reset-rollback'); await request(rollbackUser.email);
  const rollbackToken = tokenFromMail(mail.at(-1));
  await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_fail_password_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash" THEN RAISE EXCEPTION 'synthetic password write failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER audit_fail_password_reset BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION audit_fail_password_reset()');
  try {
    check((await complete(rollbackToken)).status === 400, 'Injected password update failure returns a generic error');
    check(!!await prisma.verificationToken.findUnique({ where: { token: digest(rollbackToken) } }), 'Failed transaction rolls back token consumption');
    check((await prisma.user.findUnique({ where: { id: rollbackUser.id } })).passwordHash === originalHash, 'Failed transaction preserves the old credential');
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS audit_fail_password_reset ON "User"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS audit_fail_password_reset()');
  }
  check((await complete(rollbackToken)).status === 200, 'Rolled-back reset remains usable for a safe retry');

  const failedMail = await account('reset-mail-failure'); mailStatus = 503;
  check((await request(failedMail.email)).status === 200, 'Email failure still returns the non-enumerating response');
  const failedToken = tokenFromMail(mail.at(-1));
  check(!await prisma.verificationToken.findUnique({ where: { token: digest(failedToken) } }), 'Unsent recovery link is invalidated');
  mailStatus = 200;
  const statuses = [];
  for (let index = 0; index < 4; index++) statuses.push((await request(`limited-${suffix}@audit.invalid`)).status);
  check(statuses.slice(0, 3).every(status => status === 200) && statuses[3] === 429, 'Persistent email hash limit applies even to nonexistent accounts');
  const ipStatuses = [];
  for (let index = 0; index < 11; index++) ipStatuses.push((await request(`ip-${index}-${suffix}@audit.invalid`, '203.0.113.201')).status);
  check(ipStatuses.slice(0, 10).every(status => status === 200) && ipStatuses[10] === 429, 'Persistent IP limit applies across different email addresses');
  check((await requestReset(makeRequest('/api/password-reset/request', { email: user.email }, '203.0.113.202', 'https://other.invalid'))).status === 403, 'Cross-origin recovery request is rejected');
  const oversized = new Request(`${process.env.AUTH_URL}/api/password-reset/complete`, { method: 'POST', headers: { origin: process.env.AUTH_URL }, body: 'x'.repeat(8193) });
  check((await completeReset(oversized)).status === 400, 'Oversized anonymous body is refused without parsing');
  const previousAuth = process.env.AUTH_URL;
  process.env.VERCEL_ENV = 'preview'; process.env.AUTH_URL = 'https://unitrixapp.com.br';
  check(passwordResetOrigin('https://unitrixapp.com.br/api/password-reset/request') === null, 'Preview cannot inherit the production email origin');
  process.env.AUTH_URL = previousAuth; delete process.env.VERCEL_ENV;
  console.log(`${checks} password reset assertions passed; loopback DB and mocked email only`);
} finally {
  globalThis.fetch = originalFetch;
  process.env.EMAIL_PROVIDER = 'none'; delete process.env.RESEND_API_KEY;
  await prisma.$disconnect();
}
