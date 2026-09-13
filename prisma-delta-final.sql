-- CreateTable
CREATE TABLE "comment_automation_rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "targetType" TEXT NOT NULL DEFAULT 'all',
    "mediaId" TEXT,
    "replyMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "maxRepliesPerRun" INTEGER NOT NULL DEFAULT 10,
    "maxRepliesPerHour" INTEGER NOT NULL DEFAULT 20,
    "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 60,
    "minimumIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'outro',
    "exactReply" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_profile_rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramUsername" TEXT NOT NULL,
    "displayName" TEXT,
    "category" TEXT,
    "customInstructions" TEXT NOT NULL,
    "fixedReply" TEXT,
    "useAI" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_profile_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reply_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "commenterUsername" TEXT NOT NULL,
    "originalComment" TEXT NOT NULL,
    "commentCategory" TEXT,
    "generatedReply" TEXT,
    "finalReply" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceRule" TEXT,
    "externalReplyId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "ruleId" TEXT,

    CONSTRAINT "comment_reply_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_automation_rule_userId_enabled_idx" ON "comment_automation_rule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "reply_template_userId_active_idx" ON "reply_template"("userId", "active");

-- CreateIndex
CREATE INDEX "special_profile_rule_userId_active_idx" ON "special_profile_rule"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "special_profile_rule_userId_instagramUsername_key" ON "special_profile_rule"("userId", "instagramUsername");

-- CreateIndex
CREATE INDEX "comment_reply_log_userId_status_idx" ON "comment_reply_log"("userId", "status");

-- CreateIndex
CREATE INDEX "comment_reply_log_userId_createdAt_idx" ON "comment_reply_log"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reply_log_mediaId_commentId_key" ON "comment_reply_log"("mediaId", "commentId");

-- AddForeignKey
ALTER TABLE "comment_automation_rule" ADD CONSTRAINT "comment_automation_rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_template" ADD CONSTRAINT "reply_template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_template" ADD CONSTRAINT "reply_template_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "comment_automation_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_profile_rule" ADD CONSTRAINT "special_profile_rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reply_log" ADD CONSTRAINT "comment_reply_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reply_log" ADD CONSTRAINT "comment_reply_log_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reply_log" ADD CONSTRAINT "comment_reply_log_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "comment_automation_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

