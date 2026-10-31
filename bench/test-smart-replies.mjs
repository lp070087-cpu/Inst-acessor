// Respostas Inteligentes — fluxo ponta a ponta com banco DESCARTÁVEL e rede bloqueada.
// Driver: sobe um PostgreSQL embutido só em loopback (inst_acessor_audit), aplica o
// schema e roda os casos num processo filho com `offline-network.cjs` + fetch mockado.
// Nenhuma chamada real à Meta/Instagram, nenhum banco real, nenhum segredo real.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');

if (!process.argv.includes('--cases')) {
  const { LocalPostgres } = await import('./local-postgres.mjs');
  const { Client } = await import('pg');
  const require = createRequire(import.meta.url);
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC', 'ComSpec', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA']) if (process.env[key]) env[key] = process.env[key];
  const port = await new Promise((res, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const folder = resolve(root, `outputs/smart-replies-postgres-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const postgres = new LocalPostgres(folder, port);
  const url = `postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
  Object.assign(env, {
    DATABASE_URL: url, DIRECT_URL: url, AUDIT_DATABASE_PORT: String(port),
    TOKEN_ENCRYPTION_KEY: 'audit-only-fictitious-encryption-key-2026',
    NODE_OPTIONS: `--require "${resolve(root, 'bench/offline-network.cjs').replaceAll('\\', '/')}"`,
  });
  const prismaCli = resolve(require.resolve('prisma/package.json'), '..', 'build/index.js');
  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase('inst_acessor_audit');
    const schema = await new Promise((res, reject) => {
      const c = spawn(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd: root, env });
      let out = ''; let err = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
      c.once('close', code => code === 0 ? res(out) : reject(new Error(err.slice(-2000))));
    });
    const client = new Client({ connectionString: url }); await client.connect();
    try { await client.query(schema); } finally { await client.end(); }
    const child = spawn(process.execPath, ['--import', './bench/register-ts-alias.mjs', 'bench/test-smart-replies.mjs', '--cases'], { cwd: root, env, windowsHide: true });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    const exit = await new Promise((res, reject) => { child.once('error', reject); child.once('close', res); });
    mkdirSync(resolve(root, 'outputs/verification'), { recursive: true });
    writeFileSync(resolve(root, 'outputs/verification/test-smart-replies.log'), output);
    process.stdout.write(output);
    assert.equal(exit, 0); assert.match(output, /\d+ smart-replies assertions passed/);
  } finally { await postgres.stop(); }
} else {
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
  assert.equal(target.pathname, '/inst_acessor_audit');

  // ---- fetch mockado: registra toda chamada e responde por roteiro ----
  const calls = [];
  let responder = () => { throw new Error('Provider network prohibited'); };
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : null });
    return responder(url, init);
  };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  process.env.INSTAGRAM_APP_ID = 'synthetic-app-id';
  process.env.INSTAGRAM_APP_SECRET = 'synthetic-app-secret-for-local-tests';
  process.env.INSTAGRAM_REDIRECT_URI = 'https://audit.invalid/api/integrations/instagram/callback';
  delete process.env.META_APP_SECRET;
  delete process.env.INSTAGRAM_SCOPES;

  const { prisma } = await import('../src/lib/db.ts');
  const { encryptToken } = await import('../src/lib/crypto.ts');
  const { createHmac } = await import('node:crypto');
  const { getInstagramAccountInfo, exchangeCodeForToken, buildAuthUrl } = await import('../src/lib/integrations/instagram/index.ts');
  const { subscribeInstagramWebhooks, webhookFieldsForScopes } = await import('../src/lib/integrations/instagram/webhook-subscription.ts');
  const { checkLimits } = await import('../src/lib/comment-replies/limits.ts');
  const { sendApprovedReply } = await import('../src/lib/comment-replies/engine.ts');
  const { listMessages, listConversations } = await import('../src/lib/comment-direct/instagram-direct.ts');
  const { GET: webhookGet, POST: webhookPost } = await import('../src/app/api/webhooks/instagram/route.ts');

  let checks = 0;
  const check = (cond, name) => { assert.ok(cond, name); checks++; console.log(`ok ${name}`); };
  const SECRET_TOKEN = 'synthetic-user-token-never-real';
  const IG_ID = '17841400000000001';     // me.user_id → entry.id dos webhooks
  const APP_SCOPED = '9000000000000001'; // me.id

  // ================= OAuth / conta =================
  const auth = new URL(buildAuthUrl('state-xyz'));
  check(auth.origin === 'https://www.instagram.com' && auth.pathname === '/oauth/authorize', 'Authorize URL uses Instagram Business Login host');
  check(auth.searchParams.get('scope').split(',').includes('instagram_business_manage_comments'), 'Default scopes include manage_comments');

  responder = (url) => {
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return json(200, { data: [{ access_token: 'short', user_id: IG_ID, permissions: ['instagram_business_basic', 'instagram_business_manage_comments'] }] });
    if (url.startsWith('https://graph.instagram.com/access_token')) return json(200, { access_token: SECRET_TOKEN, token_type: 'bearer', expires_in: 5184000 });
    throw new Error('unexpected ' + url);
  };
  const tokenPayload = await exchangeCodeForToken('code-1');
  check(tokenPayload.accessToken === SECRET_TOKEN, 'Code exchange accepts documented data[] wrapper and yields long-lived token');
  check(tokenPayload.scopes === 'instagram_business_basic,instagram_business_manage_comments', 'Granted permissions as list are stored (not requested scopes)');
  check(!calls.some(c => c.url.includes('client_secret=') && c.url.startsWith('https://api.instagram.com')), 'Client secret never in authorization-code URL');

  responder = () => json(200, { id: APP_SCOPED, user_id: Number(IG_ID.slice(0, 15)), username: 'loja_teste', account_type: 'BUSINESS' });
  const acc = await getInstagramAccountInfo(SECRET_TOKEN);
  check(acc.id === APP_SCOPED && acc.igUserId === IG_ID.slice(0, 15), 'Account info exposes IG professional id (user_id) separately from me.id');

  // ================= Assinatura de webhooks por conta =================
  check(JSON.stringify(webhookFieldsForScopes('instagram_business_basic')) === '[]', 'No webhook field without manage scopes');
  check(JSON.stringify(webhookFieldsForScopes('instagram_business_manage_comments,instagram_business_manage_messages')) === '["comments","messages"]', 'Fields follow granted scopes');
  calls.length = 0;
  responder = () => json(200, { success: true });
  const sub = await subscribeInstagramWebhooks(SECRET_TOKEN, 'instagram_business_manage_comments,instagram_business_manage_messages');
  check(sub.ok && calls.length === 1 && calls[0].method === 'POST' && /^https:\/\/graph\.instagram\.com\/v[\d.]+\/me\/subscribed_apps$/.test(calls[0].url), 'Subscribes account via POST graph.instagram.com/me/subscribed_apps');
  check(new URLSearchParams(calls[0].body).get('subscribed_fields') === 'comments,messages' && !calls[0].url.includes(SECRET_TOKEN), 'Fields in body; token never in URL');
  responder = () => json(400, { error: { code: 10, message: 'perm' } });
  const subFail = await subscribeInstagramWebhooks(SECRET_TOKEN, 'instagram_business_manage_comments');
  check(!subFail.ok && subFail.code === '10', 'Subscription failure reported without throwing');

  // ================= Limites: aprovação humana x automação =================
  const baseRule = { enabled: false, paused: false, maxRepliesPerRun: 10, maxRepliesPerHour: 20, maxRepliesPerDay: 60, minimumIntervalSeconds: 30 };
  const st = { rule: baseRule, sentLastHour: 0, sentLastDay: 0, lastSent: null, sentThisRun: 0 };
  check(checkLimits(st, { origin: 'MANUAL' }).allowed, 'Manual approval allowed while automation switch is off');
  check(!checkLimits(st).allowed && !checkLimits(st, { origin: 'AUTO' }).allowed, 'Automatic send still blocked while automation is off');
  check(!checkLimits({ ...st, rule: { ...baseRule, paused: true } }, { origin: 'MANUAL' }).allowed, 'Global pause blocks manual too');
  check(!checkLimits({ ...st, sentLastDay: 60 }, { origin: 'MANUAL' }).allowed, 'Daily limit applies to manual');

  // ================= Webhook GET (handshake) =================
  delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  const hs = (t) => webhookGet(new Request(`https://audit.invalid/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=4242`));
  check((await hs('x')).status === 503, 'Handshake fails closed without verify token');
  process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'synthetic-verify';
  const ok = await hs('synthetic-verify');
  check(ok.status === 200 && (await ok.text()) === '4242', 'Handshake echoes challenge with correct verify token');
  check((await hs('wrong')).status === 403, 'Handshake rejects wrong verify token');

  // ================= Fixtures de banco =================
  const user = await prisma.user.create({ data: { email: 'smart-replies@audit.invalid', emailVerified: new Date(), firstAccessCompleted: true } });
  await prisma.accessGrant.create({ data: { email: user.email, origin: 'ADMIN_MANUAL', status: 'ACTIVE', startAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } });
  const conn = await prisma.socialConnection.create({ data: {
    userId: user.id, platform: 'instagram', externalAccountId: APP_SCOPED, username: 'loja_teste', status: 'CONNECTED',
    tokenEncrypted: encryptToken(SECRET_TOKEN), scopes: 'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',
  } });
  const profile = await prisma.instagramProfile.create({ data: { userId: user.id, socialConnectionId: conn.id, igAccountId: IG_ID, username: 'loja_teste' } });
  // Regra padrão do produto: automação DESLIGADA, modo aprovação.
  await prisma.commentAutomationRule.create({ data: { userId: user.id, name: 'Respostas Inteligentes', enabled: false, replyMode: 'APPROVAL', minimumIntervalSeconds: 0 } });

  const sign = (raw) => 'sha256=' + createHmac('sha256', process.env.INSTAGRAM_APP_SECRET).update(raw).digest('hex');
  const post = (raw, sig = sign(raw)) => webhookPost(new Request('https://audit.invalid/api/webhooks/instagram', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': sig, 'x-forwarded-for': '203.0.113.7' } }));

  // ================= Webhook POST: assinatura =================
  const commentEvent = JSON.stringify({ object: 'instagram', entry: [{ id: IG_ID, time: Math.floor(Date.now() / 1000), changes: [{ field: 'comments', value: {
    id: 'cmt-1', text: 'Qual o horário de funcionamento?', from: { id: 'igsid-fan-1', username: 'fa_da_loja' }, media: { id: 'media-new-1', media_product_type: 'FEED' },
  } }] }] });
  check((await post(commentEvent, 'sha256=' + '0'.repeat(64))).status === 403, 'Invalid X-Hub-Signature-256 rejected');
  check((await post(commentEvent, null)).status === 403, 'Missing signature rejected');
  check(await prisma.instagramComment.count() === 0, 'Rejected delivery persists nothing');

  // ================= Webhook POST: comentário em publicação NÃO sincronizada =================
  calls.length = 0;
  responder = () => { throw new Error('Provider network prohibited'); };
  const res1 = await post(commentEvent);
  const body1 = await res1.json();
  check(res1.status === 200 && body1.processed === 1, 'Comment on not-yet-synced post is processed (was dropped before)');
  const media = await prisma.instagramMedia.findUnique({ where: { igMediaId: 'media-new-1' } });
  check(media && media.userId === user.id && media.profileId === profile.id && media.mediaProductType === 'FEED', 'Media row registered from event data, owned by the account in entry.id');
  const stored = await prisma.instagramComment.findUnique({ where: { igCommentId: 'cmt-1' } });
  check(stored && stored.mediaId === media.id && !stored.isOwn, 'Comment persisted under correct user/media');
  const log = await prisma.commentReplyLog.findUnique({ where: { mediaId_commentId: { mediaId: 'media-new-1', commentId: 'cmt-1' } } });
  check(log && log.status === 'PENDING' && log.socialConnectionId === conn.id, 'Suggestion logged as PENDING for manual approval');
  check(calls.length === 0, 'Webhook in APPROVAL mode makes no Instagram call');

  // Reentrega idempotente
  const res2 = await post(commentEvent);
  check(res2.status === 200 && await prisma.commentReplyLog.count() === 1 && await prisma.instagramMedia.count() === 1, 'Redelivery does not duplicate media/log');

  // Conta desconhecida + mídia desconhecida → descartado
  const foreign = JSON.stringify({ object: 'instagram', entry: [{ id: '17841499999999999', changes: [{ field: 'comments', value: { id: 'cmt-x', text: 'oi', from: { id: 'z', username: 'z' }, media: { id: 'media-foreign' } } }] }] });
  const resF = await (await post(foreign)).json();
  check(resF.skipped === 1 && !(await prisma.instagramMedia.findUnique({ where: { igMediaId: 'media-foreign' } })), 'Unknown account + unknown media is ignored (no invented owner)');

  // ================= Webhook POST: DM com entry.id = IG_ID =================
  const dm = JSON.stringify({ object: 'instagram', entry: [{ id: IG_ID, time: Math.floor(Date.now() / 1000), messaging: [
    { sender: { id: 'igsid-fan-1' }, recipient: { id: IG_ID }, timestamp: Date.now(), message: { mid: 'mid-1', text: 'Oi, quero saber o preço' } },
  ] }] });
  const resDm = await (await post(dm)).json();
  check(resDm.messagesPersisted === 1, 'Direct message mapped to the account via IG professional id');
  const conv = await prisma.directConversation.findFirst({ where: { userId: user.id } });
  check(conv && conv.participantId === 'igsid-fan-1', 'Conversation keyed by the contact (not our own account)');

  // ================= Aprovação manual e envio =================
  // 1) Meta recusa (permissão): nada publicado → ERROR com código real, reenviável.
  calls.length = 0;
  responder = (url) => url.endsWith('/cmt-1/replies') ? json(400, { error: { code: 10, message: 'Application does not have permission' } }) : json(500, {});
  const r1 = await sendApprovedReply(user.id, log.id, 'Abrimos das 9h às 18h!', 'MANUAL');
  check(!r1.ok && r1.code === 'capability', 'Manual approval reaches Instagram even with automation off; permission error typed');
  check(calls.length === 1 && calls[0].method === 'POST' && /^https:\/\/graph\.instagram\.com\/v[\d.]+\/cmt-1\/replies$/.test(calls[0].url), 'Reply sent to POST graph.instagram.com/{comment-id}/replies');
  check(new URLSearchParams(calls[0].body).get('message') === 'Abrimos das 9h às 18h!' && !calls[0].url.includes(SECRET_TOKEN), 'Reply text and token travel in body only');
  let row = await prisma.commentReplyLog.findUnique({ where: { id: log.id } });
  check(row.status === 'ERROR' && row.errorCode === 'capability', 'Definitive rejection is NOT left as reconciliation_required');
  const rule = await prisma.commentAutomationRule.findFirst({ where: { userId: user.id } });
  check(rule.paused === true, 'Permission error pauses the feature (user sees reason)');
  await prisma.commentAutomationRule.update({ where: { id: rule.id }, data: { paused: false } });

  // 2) Depois de resolvido, a MESMA sugestão pode ser reenviada e é publicada.
  responder = (url) => url.endsWith('/cmt-1/replies') ? json(200, { id: 'reply-ig-1' }) : json(500, {});
  const r2 = await sendApprovedReply(user.id, log.id, 'Abrimos das 9h às 18h!', 'MANUAL');
  row = await prisma.commentReplyLog.findUnique({ where: { id: log.id } });
  check(r2.ok && r2.replyId === 'reply-ig-1' && row.status === 'SENT' && row.externalReplyId === 'reply-ig-1' && row.sourceRule === 'MANUAL', 'Retry after rejection succeeds and history records SENT/MANUAL');
  const r3 = await sendApprovedReply(user.id, log.id, 'Abrimos das 9h às 18h!', 'MANUAL');
  check(r3.ok && calls.filter(c => c.url.endsWith('/cmt-1/replies')).length === 2, 'Idempotent: second approval does not post again');

  // 3) Desfecho incerto (rede) → reconciliation_required, sem reenvio às cegas.
  const log2 = await prisma.commentReplyLog.create({ data: { userId: user.id, socialConnectionId: conn.id, mediaId: 'media-new-1', commentId: 'cmt-2', commenterUsername: 'x', originalComment: 'amei', status: 'PENDING' } });
  responder = () => { throw new TypeError('fetch failed'); };
  const r4 = await sendApprovedReply(user.id, log2.id, 'Obrigado!', 'MANUAL');
  row = await prisma.commentReplyLog.findUnique({ where: { id: log2.id } });
  check(!r4.ok && row.status === 'ERROR' && row.errorCode === 'reconciliation_required', 'Ambiguous network failure stays reserved for reconciliation');
  // 4) HTTP 200 sem id não vira "capability" nem pausa.
  const log3 = await prisma.commentReplyLog.create({ data: { userId: user.id, socialConnectionId: conn.id, mediaId: 'media-new-1', commentId: 'cmt-3', commenterUsername: 'y', originalComment: 'top', status: 'PENDING' } });
  responder = () => json(200, {});
  const r5 = await sendApprovedReply(user.id, log3.id, 'Valeu!', 'MANUAL');
  check(!r5.ok && r5.code === 'api' && !(await prisma.commentAutomationRule.findFirst({ where: { userId: user.id } })).paused, '200 without id is ambiguous api error, does not pause');

  // ================= Direct: reconhecer a própria conta =================
  const creds = { connectionId: conn.id, igUserId: IG_ID, accessToken: SECRET_TOKEN, scopes: conn.scopes, ownAccountIds: [IG_ID, APP_SCOPED] };
  responder = (url) => url.includes('/conversations')
    ? json(200, { data: [{ id: 'conv-1', participants: { data: [{ id: IG_ID, username: 'loja_teste' }, { id: 'igsid-fan-1', username: 'fa_da_loja' }] }, messages: { data: [{ id: 'm', message: 'oi', created_time: '2026-10-30T10:00:00+0000' }] } }] })
    : json(200, { data: [{ id: 'm1', message: 'oi', from: { id: 'igsid-fan-1' } }, { id: 'm2', message: 'olá!', from: { id: IG_ID } }] });
  const convs = await listConversations(creds);
  check(convs[0].participantId === 'igsid-fan-1' && convs[0].participantUsername === 'fa_da_loja', 'Conversation contact is the other participant, not our account');
  const msgs = await listMessages(creds, 'conv-1');
  check(msgs[0].direction === 'INBOUND' && msgs[1].direction === 'OUTBOUND' && msgs[1].fromUs, 'Own messages recognised by IG professional id');

  await prisma.$disconnect();
  console.log(`${checks} smart-replies assertions passed`);
}
