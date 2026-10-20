import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Only the freshly created, explicitly identified loopback cluster is allowed.
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.ok(process.env.AUDIT_DATABASE_PORT);
assert.equal(target.port, process.env.AUDIT_DATABASE_PORT);
assert.equal(target.pathname, '/inst_acessor_audit');
const { prisma } = await import('../src/lib/db.ts');
const { grantXpAmount, withGamificationTransaction, levelInfoFromXp, getUserProgress } = await import('../src/lib/gamification/xp.ts');
const { getUserAchievements, checkAndUnlockAchievements, getAchievementBySlug } = await import('../src/lib/gamification/progress.ts');
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`ok ${label}`); };
const suffix = randomUUID();
const user = await prisma.user.create({ data: { email: `xp-${suffix}@audit.invalid`, passwordHash: 'synthetic' } });
const rewardUser = await prisma.user.create({ data: { email: `reward-${suffix}@audit.invalid`, passwordHash: 'synthetic' } });
try {
  const amounts = [11, 12, 13, 14, 15, 16];
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const distinct = await Promise.all(amounts.map((amount, index) => grantXpAmount(user.id, 'concurrency-distinct', `ref-${index}`, amount)));
  check(distinct.every(result => result.granted), 'Different concurrent references all grant XP');
  let state = await prisma.userLevel.findUnique({ where: { userId: user.id } });
  check(state.xp === total && state.totalXpEarned === total, 'Concurrent increments preserve the exact XP sum');
  check(await prisma.xpLog.count({ where: { userId: user.id } }) === amounts.length, 'Distinct grants each have one audit log');
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => grantXpAmount(user.id, 'concurrency-same', 'single-ref', 25)));
  check(duplicates.filter(result => result.granted).length === 1, 'Same reference grants exactly once under concurrency');
  check(duplicates.filter(result => result.alreadyGranted).length === 7, 'Replays return already granted instead of P2002');
  check(await prisma.xpLog.count({ where: { userId: user.id, source: 'concurrency-same' } }) === 1, 'Duplicate reference has one durable log');
  await withGamificationTransaction(user.id, async () => {
    await grantXpAmount(user.id, 'concurrency-nested', 'nested-ref', 9);
    await grantXpAmount(user.id, 'concurrency-nested', 'nested-ref', 9);
  });
  state = await prisma.userLevel.findUnique({ where: { userId: user.id } });
  const expected = total + 25 + 9;
  check(state.xp === expected, 'Nested transaction and repeated lock are reentrant without duplicate XP');
  check(state.level === levelInfoFromXp(expected).level, 'Level curve is preserved after concurrent grants');

  // The audit log is written first; a later level-write failure must undo it.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_fail_xp_level() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.xp > OLD.xp THEN RAISE EXCEPTION 'synthetic XP write failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER audit_fail_xp_level BEFORE UPDATE ON "UserLevel" FOR EACH ROW EXECUTE FUNCTION audit_fail_xp_level()');
  try {
    await assert.rejects(grantXpAmount(user.id, 'concurrency-crash', 'crash-ref', 20)); checks++;
    check(await prisma.xpLog.count({ where: { userId: user.id, source: 'concurrency-crash' } }) === 0, 'Level failure rolls back the audit log');
    check((await prisma.userLevel.findUnique({ where: { userId: user.id } })).xp === expected, 'Level failure leaves XP unchanged');
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS audit_fail_xp_level ON "UserLevel"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS audit_fail_xp_level()');
  }
  check((await grantXpAmount(user.id, 'concurrency-crash', 'crash-ref', 20)).granted, 'Failed grant remains retryable after rollback');

  // Initialize existing reward rows, then fail after reward XP and before flags.
  await getUserProgress(rewardUser.id);
  await getUserAchievements(rewardUser.id);
  await prisma.socialDraft.create({ data: { userId: rewardUser.id, platform: 'instagram', mediaType: 'image', caption: 'Synthetic reward fixture' } });
  const achievement = await prisma.achievement.findUnique({ where: { slug: 'primeiro-rascunho' } });
  assert.ok(achievement);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_fail_xp_reward() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.unlocked AND NOT OLD.unlocked THEN RAISE EXCEPTION 'synthetic reward flag failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER audit_fail_xp_reward BEFORE UPDATE ON "UserAchievement" FOR EACH ROW EXECUTE FUNCTION audit_fail_xp_reward()');
  try {
    await assert.rejects(checkAndUnlockAchievements(rewardUser.id)); checks++;
    const rewardRow = await prisma.userAchievement.findUnique({ where: { userId_achievementId: { userId: rewardUser.id, achievementId: achievement.id } } });
    check(!rewardRow.unlocked && !rewardRow.xpGranted, 'Reward flag failure leaves achievement locked and unpaid');
    check((await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp === 0, 'Reward flag failure rolls back granted XP');
    check(await prisma.xpLog.count({ where: { userId: rewardUser.id } }) === 0, 'Reward flag failure rolls back reward audit');
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS audit_fail_xp_reward ON "UserAchievement"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS audit_fail_xp_reward()');
  }
  const rewards = await Promise.all(Array.from({ length: 4 }, () => checkAndUnlockAchievements(rewardUser.id)));
  check(rewards.filter(result => result.xpGrantedNow).length === 1, 'Concurrent achievement checks award the reward once');
  check(await prisma.xpLog.count({ where: { userId: rewardUser.id, source: 'conquista-desbloqueada', refId: 'primeiro-rascunho' } }) === 1, 'Achievement reward has one audit record');
  check((await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp === getAchievementBySlug('primeiro-rascunho').xpReward, 'Achievement XP matches the unchanged official catalog');

  const historicalDate = new Date('2025-01-10T12:00:00.000Z');
  const legacy = await prisma.achievement.findUnique({ where: { slug: 'primeira-copy' } });
  await prisma.userAchievement.update({ where: { userId_achievementId: { userId: rewardUser.id, achievementId: legacy.id } },
    data: { unlocked: true, xpGranted: false, unlockedAt: historicalDate } });
  const belowThreshold = (await getUserAchievements(rewardUser.id)).find(row => row.slug === 'primeira-copy');
  check(belowThreshold.progress < belowThreshold.threshold, 'Historical unlocked fixture has progress below the current threshold');
  const beforeLegacy = (await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp;
  const legacyResults = await Promise.all(Array.from({ length: 4 }, () => checkAndUnlockAchievements(rewardUser.id)));
  check(legacyResults.filter(result => result.xpGrantedNow).length === 1, 'Historical unpaid achievement pays once across four concurrent retries');
  check(legacyResults.every(result => !result.unlockedNow), 'Recovered reward does not claim a new unlock');
  check(await prisma.xpLog.count({ where: { userId: rewardUser.id, source: 'conquista-desbloqueada', refId: legacy.slug } }) === 1, 'Historical reward creates one payout log');
  const recovered = await prisma.userAchievement.findUnique({ where: { userId_achievementId: { userId: rewardUser.id, achievementId: legacy.id } } });
  check(recovered.xpGranted && recovered.unlockedAt.getTime() === historicalDate.getTime(), 'Historical unlock date is preserved when unpaid flag is repaired');
  check((await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp === beforeLegacy + legacy.xpReward, 'Historical reward increments XP by the unchanged catalog amount');

  // Existing audit plus correct balance: repair only the missing reward flag.
  // This is not a reconstruction of potentially incorrect historical balances.
  const paid = await prisma.achievement.findUnique({ where: { slug: 'primeira-ideia' } });
  await grantXpAmount(rewardUser.id, 'conquista-desbloqueada', paid.slug, paid.xpReward);
  await prisma.userAchievement.update({ where: { userId_achievementId: { userId: rewardUser.id, achievementId: paid.id } },
    data: { unlocked: true, xpGranted: false, unlockedAt: historicalDate } });
  const alreadyPaid = (await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp;
  const paidResults = await Promise.all(Array.from({ length: 4 }, () => checkAndUnlockAchievements(rewardUser.id)));
  check(paidResults.every(result => !result.xpGrantedNow), 'Existing reward audit prevents a second payout while repairing flags');
  check((await prisma.userLevel.findUnique({ where: { userId: rewardUser.id } })).xp === alreadyPaid, 'Existing audited reward does not change the balance again');
  check(await prisma.xpLog.count({ where: { userId: rewardUser.id, source: 'conquista-desbloqueada', refId: paid.slug } }) === 1, 'Existing reward audit remains unique');
  const paidFlag = await prisma.userAchievement.findUnique({ where: { userId_achievementId: { userId: rewardUser.id, achievementId: paid.id } } });
  check(paidFlag.xpGranted && paidFlag.unlockedAt.getTime() === historicalDate.getTime(), 'Audited reward repairs its flag and preserves historical date');
  console.log(`${checks} gamification concurrency assertions passed`);
} finally { await prisma.$disconnect(); }
