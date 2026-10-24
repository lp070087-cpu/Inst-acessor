import { prisma, withDatabaseTransaction } from "@/lib/db";
import { getAdapter } from "./adapters";
import { isOfficialAdminEmail } from "@/lib/auth/admin-access";
import { hasVerifiedIdentity } from "@/lib/auth/identity";
import { recordUsage } from "@/lib/billing/usage/meter";

export interface ReconciliationInput {
  actorId: string;
  queueId: string;
  externalId: string;
  reviewedContent: boolean;
}

/** Read-only provider verification; never invokes publish or clears quarantine for retry. */
export async function reconcilePublication(input: ReconciliationInput) {
  const actor = await prisma.user.findUnique({ where: { id: input.actorId },
    select: { email: true, status: true, emailVerified: true, firstAccessCompleted: true } });
  if (!actor || actor.status !== "ACTIVE" || !hasVerifiedIdentity(actor) || !isOfficialAdminEmail(actor.email)) {
    return { ok: false, code: "FORBIDDEN" as const };
  }
  if (!input.reviewedContent || !/^[a-zA-Z0-9_.~-]{1,200}$/.test(input.externalId)) {
    return { ok: false, code: "INVALID" as const };
  }
  const item = await prisma.publishQueue.findUnique({ where: { id: input.queueId } });
  if (!item || item.status !== "FALHOU" || item.errorCode !== "RECONCILIATION_REQUIRED") {
    return { ok: false, code: "CONFLICT" as const };
  }
  const owner = await prisma.user.findUnique({ where: { id: item.userId }, select: { status: true } });
  if (!owner || owner.status !== "ACTIVE") return { ok: false, code: "FORBIDDEN" as const };
  if (item.externalId && item.externalId !== input.externalId) return { ok: false, code: "INVALID" as const };
  const adapter = getAdapter(item.platform);
  if (!adapter) return { ok: false, code: "INVALID" as const };
  const remote = await adapter.getStatus({ contentId: item.contentId, platform: item.platform, externalId: input.externalId });
  if (!remote.ok || remote.status !== "LIVE" || (remote.externalId && remote.externalId !== input.externalId)) {
    return { ok: false, code: "UNCONFIRMED" as const };
  }
  // Provider status verifies existence/status; the explicit human review confirms correspondence.
  const changed = await withDatabaseTransaction(async () => {
    const claim = await prisma.publishQueue.updateMany({ where: { id: item.id, userId: item.userId,
      status: "FALHOU", errorCode: "RECONCILIATION_REQUIRED", updatedAt: item.updatedAt },
      data: { status: "PUBLICADO", externalId: input.externalId, nextAttemptAt: null, errorCode: null, errorMessage: null } });
    if (claim.count !== 1) return false;
    const content = await prisma.plannedContent.updateMany({ where: { id: item.contentId, userId: item.userId },
      data: { status: "PUBLICADO", externalId: input.externalId,
        ...(remote.publishedAt && Number.isFinite(Date.parse(remote.publishedAt)) ? { publishedAt: new Date(remote.publishedAt) } : {}) } });
    if (content.count !== 1) throw new Error("Reconciliation content ownership changed");
    await prisma.publishLog.create({ data: { userId: item.userId, queueId: item.id, contentId: item.contentId,
      platform: item.platform, operation: "reconcile", status: "success", attempts: item.attempts,
      externalId: input.externalId, provider: adapter.name,
      errorMessage: JSON.stringify({ actorId: input.actorId, evidence: "provider_live_and_human_content_review", previousStatus: item.status }) } });
    return true;
  });
  if (changed) await recordUsage({ userId: item.userId, feature: "publication", origin: `publish:${item.platform}`, idempotencyKey: `pub:${input.externalId}` });
  return changed ? { ok: true, code: "CONFIRMED" as const } : { ok: false, code: "CONFLICT" as const };
}
