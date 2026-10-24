-- Additive pre-launch domain. No legacy WaitlistEntry or production data touched.
CREATE TABLE "LaunchSubscriber" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "whatsapp" TEXT NOT NULL,
 "planSlug" TEXT NOT NULL, "source" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "emailConsent" BOOLEAN NOT NULL, "whatsappConsent" BOOLEAN NOT NULL,
 "verificationHash" TEXT, "verificationExpiresAt" TIMESTAMP(3), "unsubscribeHash" TEXT, "unsubscribeSecret" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3), "unsubscribedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LaunchSubscriber_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LaunchConsent" (
 "id" TEXT NOT NULL, "subscriberId" TEXT NOT NULL, "channel" TEXT NOT NULL, "granted" BOOLEAN NOT NULL,
 "version" TEXT NOT NULL, "source" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LaunchConsent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LaunchCampaign" (
 "id" TEXT NOT NULL, "key" TEXT NOT NULL, "channel" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PREPARED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LaunchCampaign_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LaunchNotification" (
 "id" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "subscriberId" TEXT NOT NULL, "campaignId" TEXT,
 "kind" TEXT NOT NULL, "channel" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'HELD', "privatePayload" TEXT,
 "attempts" INTEGER NOT NULL DEFAULT 0, "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "providerId" TEXT, "errorCode" TEXT, "sentAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LaunchNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LaunchSubscriber_email_key" ON "LaunchSubscriber"("email");
CREATE UNIQUE INDEX "LaunchSubscriber_whatsapp_key" ON "LaunchSubscriber"("whatsapp");
CREATE UNIQUE INDEX "LaunchSubscriber_verificationHash_key" ON "LaunchSubscriber"("verificationHash");
CREATE UNIQUE INDEX "LaunchSubscriber_unsubscribeHash_key" ON "LaunchSubscriber"("unsubscribeHash");
CREATE INDEX "LaunchSubscriber_status_createdAt_idx" ON "LaunchSubscriber"("status", "createdAt");
CREATE INDEX "LaunchConsent_subscriberId_createdAt_idx" ON "LaunchConsent"("subscriberId", "createdAt");
CREATE UNIQUE INDEX "LaunchCampaign_key_key" ON "LaunchCampaign"("key");
CREATE UNIQUE INDEX "LaunchNotification_idempotencyKey_key" ON "LaunchNotification"("idempotencyKey");
CREATE INDEX "LaunchNotification_status_leaseUntil_idx" ON "LaunchNotification"("status", "leaseUntil");
CREATE INDEX "LaunchNotification_campaignId_status_idx" ON "LaunchNotification"("campaignId", "status");
ALTER TABLE "LaunchConsent" ADD CONSTRAINT "LaunchConsent_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "LaunchSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchNotification" ADD CONSTRAINT "LaunchNotification_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "LaunchSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchNotification" ADD CONSTRAINT "LaunchNotification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LaunchCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
