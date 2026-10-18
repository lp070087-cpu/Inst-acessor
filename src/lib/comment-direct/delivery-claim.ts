import { prisma, withDatabaseTransaction } from "@/lib/db";

export async function claimDirectDelivery(input: {
  logId: string; userId: string; ruleId: string; commenterId: string | null;
  onePerUser: boolean; dailyLimit: number;
}): Promise<boolean> {
  return withDatabaseTransaction(async () => {
    await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`direct:${input.userId}`}, 0))`;
    const rule = await prisma.commentDirectRule.findUnique({ where: { id: input.ruleId } });
    if (!rule || rule.userId !== input.userId || !rule.enabled || (rule.pausedUntil && rule.pausedUntil > new Date())) return false;
    if (rule.onePerUser) {
      if (!input.commenterId) return false;
      const prior = await prisma.commentDirectLog.findFirst({ where: {
        userId: input.userId, ruleId: input.ruleId, commenterId: input.commenterId,
        status: { in: ["PROCESSING", "SENT"] },
      } });
      if (prior) return false;
    }
    const used = await prisma.commentDirectLog.count({ where: {
      userId: input.userId, ruleId: input.ruleId, status: { in: ["PROCESSING", "SENT"] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    } });
    if (used >= rule.dailyLimit) return false;
    const claimed = await prisma.commentDirectLog.updateMany({
      where: { id: input.logId, userId: input.userId, status: "PENDING" }, data: { status: "PROCESSING" },
    });
    return claimed.count === 1;
  });
}
