-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "eventType" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accessSource" TEXT,
ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "externalPaymentId" TEXT,
ADD COLUMN     "grantedByAdminId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "firstAccessCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstAccessCompletedAt" TIMESTAMP(3),
ADD COLUMN     "tourCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'asaas',
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "planId" TEXT,
    "planName" TEXT,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_FIRST_ACCESS',
    "startAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "grantedByAdminId" TEXT,
    "externalPaymentId" TEXT,
    "externalSubscriptionId" TEXT,
    "firstAccessCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstAccessCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstAccessToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "FirstAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasskeyCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "transports" TEXT,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_eventId_key" ON "BillingEvent"("eventId");

-- CreateIndex
CREATE INDEX "BillingEvent_userId_idx" ON "BillingEvent"("userId");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "BillingEvent_processed_idx" ON "BillingEvent"("processed");

-- CreateIndex
CREATE INDEX "AccessGrant_email_status_idx" ON "AccessGrant"("email", "status");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_status_idx" ON "AccessGrant"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_email_origin_externalPaymentId_key" ON "AccessGrant"("email", "origin", "externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FirstAccessToken_tokenHash_key" ON "FirstAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "FirstAccessToken_email_idx" ON "FirstAccessToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");

-- CreateIndex
CREATE INDEX "Payment_externalPaymentId_idx" ON "Payment"("externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_eventId_key" ON "Payment"("eventId");

-- CreateIndex
CREATE INDEX "Subscription_externalSubscriptionId_idx" ON "Subscription"("externalSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_idempotencyKey_key" ON "Subscription"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_asaasCustomerId_key" ON "User"("asaasCustomerId");

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstAccessToken" ADD CONSTRAINT "FirstAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

