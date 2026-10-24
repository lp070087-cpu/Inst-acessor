import { prisma, withDatabaseTransaction } from "@/lib/db";
import { loadLimitState, checkLimits } from "./limits";

export async function claimCommentReply(userId: string, logId: string): Promise<boolean> {
  return withDatabaseTransaction(async () => {
    await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reply:${userId}`}, 0))`;
    const state = await loadLimitState(userId, 0);
    const pending = { OR: [{ status: "PROCESSING" }, { status: "ERROR", errorCode: "reconciliation_required" }] };
    const since = (date: Date) => ({ userId, OR: [
      { status: "SENT", sentAt: { gte: date } },
      { ...pending, approvedAt: { gte: date } },
    ] });
    const now = Date.now();
    state.sentLastHour = await prisma.commentReplyLog.count({ where: since(new Date(now - 60 * 60_000)) });
    state.sentLastDay = await prisma.commentReplyLog.count({ where: since(new Date(now - 24 * 60 * 60_000)) });
    const reserved = await prisma.commentReplyLog.findFirst({ where: { userId, ...pending }, orderBy: { approvedAt: "desc" } });
    if (reserved?.approvedAt && (!state.lastSent || reserved.approvedAt > state.lastSent)) state.lastSent = reserved.approvedAt;
    if (!checkLimits(state).allowed) return false;
    const result = await prisma.commentReplyLog.updateMany({ where: {
      id: logId, userId, status: { in: ["PENDING", "APPROVED", "ERROR"] },
      OR: [{ errorCode: null }, { errorCode: { not: "reconciliation_required" } }],
    }, data: { status: "PROCESSING", approvedAt: new Date() } });
    return result.count === 1;
  });
}
