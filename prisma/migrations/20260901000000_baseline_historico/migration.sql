-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "username" TEXT,
    "avatar" TEXT,
    "niche" TEXT,
    "subNiche" TEXT,
    "objective" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "dashboard" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "username" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'BUSINESS',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "tokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'instagram',
    "state" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeVerifier" TEXT,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "followersCount" INTEGER,
    "followsCount" INTEGER,
    "mediaCount" INTEGER,
    "profilePictureUrl" TEXT,
    "biography" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followersCount" INTEGER,
    "followsCount" INTEGER,
    "mediaCount" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "profileViews" INTEGER,
    "engagement" INTEGER,

    CONSTRAINT "InstagramSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramMedia" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "igMediaId" TEXT NOT NULL,
    "mediaType" TEXT,
    "permalink" TEXT,
    "caption" TEXT,
    "timestamp" TIMESTAMP(3),
    "likeCount" INTEGER,
    "commentsCount" INTEGER,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramMediaMetric" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "igMediaId" TEXT NOT NULL,
    "reached" INTEGER,
    "impressions" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "comments" INTEGER,
    "likes" INTEGER,
    "videoViews" INTEGER,
    "videoViewTime" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramMediaMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "itemsSynced" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "tiktokUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "videoCount" INTEGER,
    "likesCount" INTEGER,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "videoCount" INTEGER,
    "likesCount" INTEGER,
    "viewsCount" INTEGER,
    "profileViews" INTEGER,

    CONSTRAINT "TikTokSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokVideo" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tiktokVideoId" TEXT NOT NULL,
    "title" TEXT,
    "coverUrl" TEXT,
    "videoUrl" TEXT,
    "embedUrl" TEXT,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "shareCount" INTEGER,
    "playCount" INTEGER,
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT,
    "niche" TEXT,
    "subNiche" TEXT,
    "objectives" TEXT,
    "communicationStyle" TEXT,
    "observedPatterns" TEXT,
    "preferredFormats" TEXT,
    "ctaPatterns" TEXT,
    "hookPatterns" TEXT,
    "postingFrequency" TEXT,
    "voiceTone" TEXT,
    "writingStyle" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedCopy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "objective" TEXT,
    "tone" TEXT,
    "audience" TEXT,
    "context" TEXT,
    "content" TEXT NOT NULL,
    "hookType" TEXT,
    "structure" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT,
    "objective" TEXT,
    "context" TEXT,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "mediaUrl" TEXT,
    "caption" TEXT,
    "hashtags" TEXT,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "problem" TEXT NOT NULL,
    "explanation" TEXT,
    "action" TEXT,
    "evidence" TEXT,
    "ruleSlug" TEXT,
    "test" TEXT,
    "result" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "growth" INTEGER,
    "engagement" INTEGER,
    "reach" INTEGER,
    "consistency" INTEGER,
    "frequency" INTEGER,
    "content" INTEGER,
    "factors" JSONB,
    "version" TEXT NOT NULL DEFAULT 'growth-score-v1',
    "coverage" INTEGER,
    "weighting" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileScoreSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeModule" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "moduleId" TEXT,
    "module" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "tags" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthExperiment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "baseline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "contentId" TEXT,
    "variation" TEXT,
    "hookType" TEXT,
    "format" TEXT,
    "theme" TEXT,
    "structure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentObservation" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "before" DOUBLE PRECISION,
    "after" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "conclusion" TEXT,
    "confidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "ruleSlug" TEXT,
    "experimentId" TEXT,
    "confidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "SocialConnection_platform_idx" ON "SocialConnection"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_userId_platform_key" ON "SocialConnection"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");

-- CreateIndex
CREATE INDEX "OAuthState_state_idx" ON "OAuthState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramProfile_socialConnectionId_key" ON "InstagramProfile"("socialConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramProfile_igAccountId_key" ON "InstagramProfile"("igAccountId");

-- CreateIndex
CREATE INDEX "InstagramProfile_userId_idx" ON "InstagramProfile"("userId");

-- CreateIndex
CREATE INDEX "InstagramProfile_igAccountId_idx" ON "InstagramProfile"("igAccountId");

-- CreateIndex
CREATE INDEX "InstagramSnapshot_userId_capturedAt_idx" ON "InstagramSnapshot"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "InstagramSnapshot_profileId_capturedAt_idx" ON "InstagramSnapshot"("profileId", "capturedAt");

-- CreateIndex
CREATE INDEX "InstagramMedia_userId_timestamp_idx" ON "InstagramMedia"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMedia_igMediaId_key" ON "InstagramMedia"("igMediaId");

-- CreateIndex
CREATE INDEX "InstagramMediaMetric_userId_idx" ON "InstagramMediaMetric"("userId");

-- CreateIndex
CREATE INDEX "InstagramMediaMetric_mediaId_capturedAt_idx" ON "InstagramMediaMetric"("mediaId", "capturedAt");

-- CreateIndex
CREATE INDEX "SyncLog_userId_platform_createdAt_idx" ON "SyncLog"("userId", "platform", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokProfile_socialConnectionId_key" ON "TikTokProfile"("socialConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokProfile_tiktokUserId_key" ON "TikTokProfile"("tiktokUserId");

-- CreateIndex
CREATE INDEX "TikTokProfile_userId_idx" ON "TikTokProfile"("userId");

-- CreateIndex
CREATE INDEX "TikTokProfile_tiktokUserId_idx" ON "TikTokProfile"("tiktokUserId");

-- CreateIndex
CREATE INDEX "TikTokSnapshot_userId_capturedAt_idx" ON "TikTokSnapshot"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "TikTokSnapshot_profileId_capturedAt_idx" ON "TikTokSnapshot"("profileId", "capturedAt");

-- CreateIndex
CREATE INDEX "TikTokVideo_userId_timestamp_idx" ON "TikTokVideo"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokVideo_tiktokVideoId_key" ON "TikTokVideo"("tiktokVideoId");

-- CreateIndex
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_userId_idx" ON "AIMessage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIProfile_userId_key" ON "AIProfile"("userId");

-- CreateIndex
CREATE INDEX "GeneratedCopy_userId_createdAt_idx" ON "GeneratedCopy"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentIdea_userId_status_idx" ON "ContentIdea"("userId", "status");

-- CreateIndex
CREATE INDEX "ContentIdea_userId_createdAt_idx" ON "ContentIdea"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialDraft_userId_createdAt_idx" ON "SocialDraft"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorshipRecommendation_userId_status_idx" ON "MentorshipRecommendation"("userId", "status");

-- CreateIndex
CREATE INDEX "MentorshipRecommendation_userId_createdAt_idx" ON "MentorshipRecommendation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileScore_userId_platform_createdAt_idx" ON "ProfileScore"("userId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileScoreSnapshot_userId_platform_createdAt_idx" ON "ProfileScoreSnapshot"("userId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeVersion_active_idx" ON "KnowledgeVersion"("active");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_version_key" ON "KnowledgeVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeModule_slug_key" ON "KnowledgeModule"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeModule_active_idx" ON "KnowledgeModule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeModule_number_version_key" ON "KnowledgeModule"("number", "version");

-- CreateIndex
CREATE INDEX "KnowledgeRule_category_idx" ON "KnowledgeRule"("category");

-- CreateIndex
CREATE INDEX "KnowledgeRule_module_idx" ON "KnowledgeRule"("module");

-- CreateIndex
CREATE INDEX "KnowledgeRule_active_idx" ON "KnowledgeRule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRule_slug_version_key" ON "KnowledgeRule"("slug", "version");

-- CreateIndex
CREATE INDEX "GrowthExperiment_userId_status_idx" ON "GrowthExperiment"("userId", "status");

-- CreateIndex
CREATE INDEX "GrowthExperiment_userId_createdAt_idx" ON "GrowthExperiment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentVariant_experimentId_idx" ON "ExperimentVariant"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentObservation_experimentId_idx" ON "ExperimentObservation"("experimentId");

-- CreateIndex
CREATE INDEX "ProfileInsight_userId_type_idx" ON "ProfileInsight"("userId", "type");

-- CreateIndex
CREATE INDEX "ProfileInsight_userId_createdAt_idx" ON "ProfileInsight"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramProfile" ADD CONSTRAINT "InstagramProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramProfile" ADD CONSTRAINT "InstagramProfile_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramSnapshot" ADD CONSTRAINT "InstagramSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramSnapshot" ADD CONSTRAINT "InstagramSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InstagramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMedia" ADD CONSTRAINT "InstagramMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMedia" ADD CONSTRAINT "InstagramMedia_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InstagramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMediaMetric" ADD CONSTRAINT "InstagramMediaMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMediaMetric" ADD CONSTRAINT "InstagramMediaMetric_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "InstagramMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokProfile" ADD CONSTRAINT "TikTokProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokProfile" ADD CONSTRAINT "TikTokProfile_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokSnapshot" ADD CONSTRAINT "TikTokSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokSnapshot" ADD CONSTRAINT "TikTokSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TikTokProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokVideo" ADD CONSTRAINT "TikTokVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokVideo" ADD CONSTRAINT "TikTokVideo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TikTokProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProfile" ADD CONSTRAINT "AIProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCopy" ADD CONSTRAINT "GeneratedCopy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipRecommendation" ADD CONSTRAINT "MentorshipRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileScore" ADD CONSTRAINT "ProfileScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileScoreSnapshot" ADD CONSTRAINT "ProfileScoreSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileScoreSnapshot" ADD CONSTRAINT "ProfileScoreSnapshot_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "ProfileScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRule" ADD CONSTRAINT "KnowledgeRule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "KnowledgeModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRule" ADD CONSTRAINT "KnowledgeRule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "GrowthExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentObservation" ADD CONSTRAINT "ExperimentObservation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "GrowthExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileInsight" ADD CONSTRAINT "ProfileInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
