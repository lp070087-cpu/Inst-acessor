-- Additive durable inbox; historical migration checksums remain untouched.
CREATE TABLE "SocialWebhookInbox" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "rawHash" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "accountHash" TEXT NOT NULL,
  "connectionId" TEXT,
  "connectionVersion" TIMESTAMP(3),
  "reason" INTEGER,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialWebhookInbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialWebhookInbox_eventKey_key" ON "SocialWebhookInbox"("eventKey");
CREATE INDEX "SocialWebhookInbox_state_nextAttemptAt_idx" ON "SocialWebhookInbox"("state", "nextAttemptAt");
CREATE INDEX "SocialWebhookInbox_state_leaseUntil_idx" ON "SocialWebhookInbox"("state", "leaseUntil");
