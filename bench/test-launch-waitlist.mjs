import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const database = process.argv.includes('--database');
if (database) {
  // Check before importing any module that can initialize Prisma.
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, '127.0.0.1');
  assert.ok(process.env.AUDIT_DATABASE_PORT);
  assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
  assert.equal(target.pathname, '/inst_acessor_audit');
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
} else {
  process.env.DATABASE_URL = process.env.DIRECT_URL = 'postgresql://audit:audit@127.0.0.1:1/inst_acessor_audit';
}
globalThis.fetch = async () => { throw new Error('Real messaging and external services are prohibited in this suite'); };
const { launchSignupSchema, launchTokenSchema, launchCampaignSchema, CONSENT_VERSION, readLaunchBody } = await import('../src/lib/launch-waitlist/validation.ts');
const { renderLaunchMessage } = await import('../src/lib/launch-waitlist/templates.ts');
let checks = 0;
function check(condition, name) { assert.ok(condition, name); checks++; console.log(`ok ${name}`); }
const input = {
  name: 'Pessoa Ficticia', email: 'launch@audit.invalid', whatsapp: '+5511999999999', planSlug: 'mensal',
  emailConsent: true, whatsappConsent: false, source: 'landing-plan', privacyAccepted: true, website: '',
};
const valid = value => launchSignupSchema.safeParse(value).success;
check(valid(input), 'The current public form contract is accepted');
check(CONSENT_VERSION.length > 0, 'Consent has an explicit version');
for (const planSlug of ['semanal', 'mensal', 'anual']) check(valid({ ...input, planSlug }), `Confirmed plan ${planSlug} accepted`);
for (const planSlug of ['', 'vitalicio', 'admin']) check(!valid({ ...input, planSlug }), `Unknown plan ${planSlug || '(empty)'} refused`);
check(launchSignupSchema.parse({ ...input, name: '  Pessoa  ', email: ' UPPER@AUDIT.INVALID ' }).email === 'upper@audit.invalid', 'Email normalized by the server-side form schema');
for (const whatsapp of ['11999999999', 'https://wa.me/5511999999999', '+0123456789', '+123', '+1234567890123456']) {
  check(!valid({ ...input, whatsapp }), 'Non-E164 WhatsApp refused');
}
check(valid({ ...input, emailConsent: false, whatsappConsent: false }), 'Marketing channel consents are optional');
check(!valid({ ...input, privacyAccepted: false }), 'Privacy policy acceptance required');
check(!valid({ ...input, privacyAccepted: undefined }), 'Missing privacy policy acceptance refused');
check(!valid({ ...input, privacyAccepted: 'true' }), 'String privacy acceptance is not silently accepted');
check(valid({ ...input, emailConsent: false, whatsappConsent: true }), 'WhatsApp consent is independent from email marketing consent');
check(!valid({ ...input, emailConsent: 'true' }), 'String consent is not silently accepted');
check(!valid({ ...input, role: 'ADMIN' }), 'Unknown privilege-bearing fields refused');
check(!valid({ ...input, source: 'admin' }), 'Public source allowlist enforced');
check(!valid({ ...input, name: 'x'.repeat(101) }), 'Name length bounded');
check(!launchTokenSchema.safeParse({ token: 'bad-token' }).success, 'Malformed token refused');
check(!launchCampaignSchema.safeParse({ key: 'launch-1', channel: 'EMAIL' }).success, 'Campaign preparation requires explicit queue confirmation');
check(!launchCampaignSchema.safeParse({ key: 'launch-1', channel: 'SMS', confirmQueue: true }).success, 'Unapproved campaign channel refused');
check(launchCampaignSchema.safeParse({ key: 'launch-1', channel: 'EMAIL', confirmQueue: true }).success, 'Explicit email campaign contract accepted');
const body = value => new Request('http://127.0.0.1/launch', { method: 'POST', body: value });
check(await readLaunchBody(body('{invalid')) === null, 'Malformed anonymous JSON refused');
check(await readLaunchBody(body('x'.repeat(8193))) === null, 'Oversized anonymous request bounded before parse');
check((await readLaunchBody(body(JSON.stringify(input)))).planSlug === 'mensal', 'Valid form body parsed');
const template = { name: '<img src=x onerror="alert(1)"> & Pessoa', planSlug: 'mensal', unsubscribeUrl: 'https://launch.audit.invalid/lista-de-espera/cancelar#token=synthetic' };
const welcome = renderLaunchMessage({ ...template, kind: 'WELCOME' });
check(!welcome.html.includes('<img src=x') && welcome.html.includes('&lt;img'), 'Template escapes subscriber-controlled HTML');
check(welcome.text.includes(template.name), 'Plain text retains the intended subscriber name without HTML interpretation');
check(welcome.text.includes(template.unsubscribeUrl), 'Every welcome message includes unsubscribe link');
check(!welcome.text.includes('está aberta'), 'Welcome never announces an unapproved presale');
assert.throws(() => renderLaunchMessage({ ...template, kind: 'LAUNCH', saleUrl: 'https://launch.audit.invalid/planos' }), /PRESALE_APPROVAL_REQUIRED/); checks++;
assert.throws(() => renderLaunchMessage({ ...template, kind: 'LAUNCH', saleUrl: 'https://other.audit.invalid/planos', presaleApproved: true }), /CAMPAIGN_ORIGIN_MISMATCH/); checks++;
assert.throws(() => renderLaunchMessage({ ...template, kind: 'VERIFY' }), /CONFIRMATION_REQUIRED/); checks++;
assert.throws(() => renderLaunchMessage({ ...template, kind: 'WELCOME', unsubscribeUrl: 'javascript:alert(1)' }), /INVALID_CAMPAIGN_LINK/); checks++;
check(renderLaunchMessage({ ...template, kind: 'LAUNCH', saleUrl: 'https://launch.audit.invalid/planos', presaleApproved: true }).text.includes('está aberta'), 'Explicitly approved presale renders a same-origin sale link without performing delivery');

if (database) {
  const { prisma } = await import('../src/lib/db.ts');
  const { decryptToken } = await import('../src/lib/crypto.ts');
  const { registerLaunchSubscriber, confirmLaunchSubscription, unsubscribeLaunchSubscriber, prepareLaunchCampaign } = await import('../src/lib/launch-waitlist/service.ts');
  const { claimLaunchNotification, finishLaunchNotification, recoverExpiredLaunchClaims } = await import('../src/lib/launch-waitlist/outbox.ts');
  const suffix = randomBytes(6).toString('hex');
  const signup = (index, patch = {}) => ({ ...input, email: `launch-${suffix}-${index}@audit.invalid`, whatsapp: `+55118888${String(index).padStart(5, '0')}`, ...patch });
  const find = data => prisma.launchSubscriber.findUniqueOrThrow({ where: { email: data.email } });
  const secrets = async subscriber => {
    const row = await prisma.launchNotification.findFirstOrThrow({ where: { subscriberId: subscriber.id, kind: 'VERIFY', status: 'HELD' }, orderBy: { createdAt: 'desc' } });
    check(row.status === 'HELD', 'Verification waits for explicitly authorized transport');
    return JSON.parse(decryptToken(row.privatePayload));
  };
  try {
    const first = signup(1);
    await Promise.all(Array.from({ length: 8 }, () => registerLaunchSubscriber(first)));
    const person = await find(first);
    check(await prisma.launchSubscriber.count({ where: { email: first.email } }) === 1, 'Concurrent duplicate email registration creates one subscriber');
    check(await prisma.launchConsent.count({ where: { subscriberId: person.id } }) === 2, 'Consent audit written once per channel under duplicate race');
    check(await prisma.launchNotification.count({ where: { subscriberId: person.id } }) === 1, 'Duplicate signup creates only one verification intent');
    await registerLaunchSubscriber(signup(2, { whatsapp: first.whatsapp, name: 'Another identity', emailConsent: false, whatsappConsent: true }));
    check(await prisma.launchSubscriber.count({ where: { whatsapp: first.whatsapp } }) === 1, 'Duplicate WhatsApp cannot create a second identity');
    check((await find(first)).name === first.name && (await find(first)).emailConsent, 'Duplicate phone does not overwrite identity or consents');
    const token = await secrets(person);
    check(!JSON.stringify(person).includes(token.token), 'Subscriber stores hash rather than plaintext verification token');
    check((await Promise.all(Array.from({ length: 8 }, () => confirmLaunchSubscription(token.token)))).filter(Boolean).length === 1, 'Verification token consumed atomically once');
    check((await find(first)).status === 'VERIFIED', 'Successful confirmation persists verified status');
    check(!await confirmLaunchSubscription(token.token), 'Confirmed token cannot be replayed');
    check(await prisma.launchNotification.count({ where: { subscriberId: person.id, kind: 'WELCOME', channel: 'EMAIL', status: 'HELD' } }) === 1, 'Concurrent email confirmation creates exactly one held email welcome');
    check(await prisma.launchNotification.count({ where: { subscriberId: person.id, kind: 'WELCOME', channel: 'WHATSAPP' } }) === 0, 'Email-only consent never creates WhatsApp welcome');
    const pending = signup(3); await registerLaunchSubscriber(pending);
    const expired = signup(4); await registerLaunchSubscriber(expired);
    const expiredPerson = await find(expired), expiredSecret = await secrets(expiredPerson);
    await prisma.launchSubscriber.update({ where: { id: expiredPerson.id }, data: { verificationExpiresAt: new Date(Date.now() - 1000) } });
    check(!await confirmLaunchSubscription(expiredSecret.token), 'Expired token cannot activate subscription');
    const whatsappOnly = signup(5, { emailConsent: false, whatsappConsent: true }); await registerLaunchSubscriber(whatsappOnly);
    const phonePerson = await find(whatsappOnly); await confirmLaunchSubscription((await secrets(phonePerson)).token);
    check(await prisma.launchNotification.count({ where: { subscriberId: phonePerson.id, kind: 'WELCOME', channel: 'WHATSAPP', status: 'HELD' } }) === 1, 'WhatsApp-only welcome remains held pending ownership and provider authorization');
    check(await prisma.launchNotification.count({ where: { subscriberId: phonePerson.id, kind: 'WELCOME', channel: 'EMAIL' } }) === 0, 'WhatsApp-only consent never creates email marketing welcome');
    const campaignKey = `launch-${suffix}`;
    const campaigns = await Promise.all(Array.from({ length: 8 }, () => prepareLaunchCampaign({ key: campaignKey, channel: 'EMAIL' })));
    check(new Set(campaigns.map(value => value.campaignId)).size === 1, 'Concurrent campaign key creates one durable campaign');
    const queued = await prisma.launchNotification.findMany({ where: { campaignId: campaigns[0].campaignId } });
    check(queued.some(row => row.subscriberId === person.id), 'Verified email consent eligible for email campaign');
    check(!queued.some(row => row.subscriberId === phonePerson.id), 'WhatsApp-only consent never enrolls in email launch campaign');
    const pendingPerson = await find(pending);
    check(!queued.some(row => row.subscriberId === pendingPerson.id || row.subscriberId === expiredPerson.id), 'Unconfirmed and expired registrations excluded');
    check(queued.every(row => row.status === 'HELD'), 'Prepared campaign never activates messaging');
    check(await claimLaunchNotification(queued.find(row => row.subscriberId === person.id).id) === null, 'HELD campaign cannot be claimed before separate activation approval');
    await assert.rejects(() => prepareLaunchCampaign({ key: campaignKey, channel: 'WHATSAPP' }), /CAMPAIGN_CONFLICT/); checks++;
    check(await unsubscribeLaunchSubscriber(token.unsubscribeToken), 'Unsubscribe token revokes participation');
    check(await unsubscribeLaunchSubscriber(token.unsubscribeToken), 'Unsubscribe replay remains safe and idempotent');
    const unsubscribed = await find(first);
    check(unsubscribed.status === 'UNSUBSCRIBED' && !unsubscribed.emailConsent && !unsubscribed.whatsappConsent, 'Unsubscribe revokes both channel consents');
    check(await prisma.launchConsent.count({ where: { subscriberId: person.id, source: 'unsubscribe' } }) === 2, 'Repeated unsubscribe does not duplicate revocation audit');
    check(await prisma.launchNotification.count({ where: { subscriberId: person.id, status: { in: ['READY', 'HELD', 'PROCESSING'] } } }) === 0, 'Unsubscribe cancels all unsent held campaign intents');
    await registerLaunchSubscriber(first);
    check((await find(first)).status === 'UNSUBSCRIBED', 'Repeated public signup cannot silently undo unsubscribe');
    const bot = signup(6, { website: 'bot-site' }); await registerLaunchSubscriber(bot);
    check(await prisma.launchSubscriber.count({ where: { email: bot.email } }) === 0, 'Honeypot creates no subscriber or notification');
    const pendingIntent = await prisma.launchNotification.findUniqueOrThrow({ where: { idempotencyKey: `verify:${pendingPerson.id}` } });
    // Fixture-only transition: the application intentionally provides no worker
    // that promotes HELD notifications or contacts a real provider.
    await prisma.launchNotification.update({ where: { id: pendingIntent.id }, data: { status: 'READY' } });
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimLaunchNotification(pendingIntent.id)));
    check(claims.filter(Boolean).length === 1, 'One worker claims READY intent under real database concurrency');
    const claim = claims.find(Boolean);
    check(!await finishLaunchNotification(claim.id, 'stale-synthetic-token', { status: 'CANCELLED' }), 'Foreign lease cannot finalize notification');
    await prisma.launchNotification.update({ where: { id: claim.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    check(!await finishLaunchNotification(claim.id, claim.leaseToken, { status: 'SENT', providerId: 'synthetic-not-a-delivery' }), 'Expired worker cannot manufacture successful completion');
    await recoverExpiredLaunchClaims();
    check((await prisma.launchNotification.findUniqueOrThrow({ where: { id: claim.id } })).status === 'UNCERTAIN', 'Expired claim becomes uncertain instead of retryable');
    check(await claimLaunchNotification(claim.id) === null, 'Uncertain provider outcome cannot be resent automatically');
    const expiredIntent = await prisma.launchNotification.findUniqueOrThrow({ where: { idempotencyKey: `verify:${expiredPerson.id}` } });
    await prisma.launchNotification.update({ where: { id: expiredIntent.id }, data: { status: 'READY' } });
    check(await claimLaunchNotification(expiredIntent.id) === null, 'Expired verification cannot be sent even after fixture activation');
    check((await prisma.launchNotification.findUniqueOrThrow({ where: { id: expiredIntent.id } })).status === 'CANCELLED', 'Ineligible intent cancelled durably');
    const originalExpired = await find(expired);
    await registerLaunchSubscriber({ ...expired, whatsapp: '+5511888800099' });
    check((await find(expired)).verificationHash === originalExpired.verificationHash, 'Matching email alone cannot rotate another identity verification');
    await Promise.all(Array.from({ length: 8 }, () => registerLaunchSubscriber({ ...expired, name: 'Changed name', emailConsent: false, whatsappConsent: true })));
    const replacement = await secrets(expiredPerson), reissued = await find(expired);
    check(replacement.token !== expiredSecret.token, 'Expired registration receives a fresh verification token');
    check(replacement.unsubscribeToken === expiredSecret.unsubscribeToken, 'Verification reissue preserves original unsubscribe capability');
    check(reissued.name === originalExpired.name && reissued.emailConsent === originalExpired.emailConsent && reissued.whatsappConsent === originalExpired.whatsappConsent, 'Reissue cannot modify identity or channel consents');
    check(await prisma.launchNotification.count({ where: { subscriberId: expiredPerson.id, kind: 'VERIFY', status: 'HELD' } }) === 1, 'Concurrent reissue creates one current held verification intent');
    check(!await confirmLaunchSubscription(expiredSecret.token), 'Superseded verification token remains invalid');
    check(await confirmLaunchSubscription(replacement.token), 'Replacement verification can activate original registration');
    check(await unsubscribeLaunchSubscriber(expiredSecret.unsubscribeToken), 'Original unsubscribe still works after verification reissue');
    await registerLaunchSubscriber(expired);
    check((await find(expired)).status === 'UNSUBSCRIBED', 'Reissue mechanism cannot resurrect an unsubscribed registration');

    const rollback = signup(7);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_launch_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic consent failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER audit_launch_fail BEFORE INSERT ON "LaunchConsent" FOR EACH ROW EXECUTE FUNCTION audit_launch_fail()`);
    try { await assert.rejects(() => registerLaunchSubscriber(rollback)); checks++; }
    finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER audit_launch_fail ON "LaunchConsent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION audit_launch_fail()`);
    }
    check(await prisma.launchSubscriber.count({ where: { email: rollback.email } }) === 0, 'Consent write failure rolls subscriber creation back atomically');
    await registerLaunchSubscriber(rollback);
    check((await find(rollback)).status === 'PENDING', 'Rolled-back registration can be safely retried');
    const laterPerson = await find(rollback);
    await confirmLaunchSubscription((await secrets(laterPerson)).token);
    await prepareLaunchCampaign({ key: campaignKey, channel: 'EMAIL' });
    check(await prisma.launchNotification.count({ where: { campaignId: campaigns[0].campaignId, subscriberId: laterPerson.id } }) === 0, 'Campaign replay preserves original recipient snapshot');
    const whatsappCampaign = await prepareLaunchCampaign({ key: `phone-${suffix}`, channel: 'WHATSAPP' });
    check(await prisma.launchNotification.count({ where: { campaignId: whatsappCampaign.campaignId, subscriberId: phonePerson.id, status: 'HELD' } }) === 1, 'WhatsApp-only opted-in verified fixture eligible solely for held WhatsApp campaign');
    check(await prisma.launchNotification.count({ where: { campaignId: whatsappCampaign.campaignId, subscriberId: laterPerson.id } }) === 0, 'Email-only consent never enrolls in WhatsApp launch campaign');
    console.log(`${checks} launch waitlist database assertions passed; no real transport or external integration tested`);
  } finally { await prisma.$disconnect(); }
} else {
  console.log(`${checks} launch waitlist pure assertions passed; database concurrency and UI runtime NOT tested`);
}
