-- ============================================================================
-- MIGRATION INCREMENTAL — ADMIN + BILLING/ASSINATURA + PRIMEIRO ACESSO
-- ============================================================================
-- ⚠️ NÃO APLICADA. Gerada como registro do delta do schema desta rodada.
--
-- Contexto:
--   A `main` havia perdido a superfície de Admin/Billing/Primeiro Acesso. Este
--   SQL é o delta ADITIVO necessário para o código recuperado funcionar, e
--   cobre APENAS os models/colunas que o código recuperado realmente usa.
--
-- Garantias:
--   - 100% ADITIVO: nenhum DROP, nenhuma remoção de coluna, nenhum DELETE.
--   - Nenhuma tabela existente é recriada; nenhum dado é apagado.
--   - Models de Instagram/TikTok NÃO são tocados (integração atual preservada).
--
-- Modelos incluídos além do estritamente usado pelo código recuperado:
--   Rank/XP (UserLevel, XpLog, Achievement, UserAchievement), Publicação
--   (PublishQueue, PublishLog, AutomationRule, AutomationEvent,
--   AutomationExecution), GrowthAction e PasskeyCredential.
--   Motivo: o painel Admin conta métricas REAIS desses models
--   (publishQueue, publishFailures, automations, growthActions), e manter as
--   tabelas evita orfanar dados já existentes no banco. As PÁGINAS dessas
--   features continuam NÃO recuperadas.
--
-- Como aplicar (QUANDO o DONO decidir — nunca automaticamente):
--   npx prisma migrate dev   (cria/aplica incrementalmente)
--   ou  npx prisma db push   (o projeto já usa push como fluxo padrão)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) User — colunas do gateway Asaas + estado do primeiro acesso
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "asaasCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "firstAccessCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "firstAccessCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tourCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_asaasCustomerId_key" ON "User"("asaasCustomerId");

-- ---------------------------------------------------------------------------
-- 2) Plan — catálogo oficial de planos (preço SEMPRE em centavos inteiros)
-- ---------------------------------------------------------------------------
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "type" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "billingInterval" TEXT,
    "durationDays" INTEGER,
    "description" TEXT,
    "features" TEXT[],
    "badge" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");
CREATE INDEX "Plan_active_idx" ON "Plan"("active");

-- ---------------------------------------------------------------------------
-- 3) Subscription — assinatura/acesso (ASAAS ou ADMIN_MANUAL)
-- ---------------------------------------------------------------------------
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billingType" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "billingInterval" TEXT,
    "startAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "nextBillingAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "provider" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "externalPaymentId" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "paidAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "accessSource" TEXT,
    "grantedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_idempotencyKey_key" ON "Subscription"("idempotencyKey");
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX "Subscription_userId_expiresAt_idx" ON "Subscription"("userId", "expiresAt");
CREATE INDEX "Subscription_externalSubscriptionId_idx" ON "Subscription"("externalSubscriptionId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4) Payment — pagamentos (idempotência por eventId)
-- ---------------------------------------------------------------------------
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "externalPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "eventType" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_eventId_key" ON "Payment"("eventId");
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");
CREATE INDEX "Payment_externalPaymentId_idx" ON "Payment"("externalPaymentId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5) BillingEvent — webhooks (idempotência + auditoria; payload sanitizado)
-- ---------------------------------------------------------------------------
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

CREATE UNIQUE INDEX "BillingEvent_eventId_key" ON "BillingEvent"("eventId");
CREATE INDEX "BillingEvent_userId_idx" ON "BillingEvent"("userId");
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");
CREATE INDEX "BillingEvent_processed_idx" ON "BillingEvent"("processed");

ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6) CheckoutOrder — pedido local do checkout hospedado (externalReference única)
-- ---------------------------------------------------------------------------
CREATE TABLE "CheckoutOrder" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "planId" TEXT,
    "planSlug" TEXT NOT NULL,
    "planName" TEXT,
    "expectedAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingType" TEXT NOT NULL,
    "billingInterval" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalReference" TEXT NOT NULL,
    "externalCheckoutId" TEXT,
    "externalPaymentId" TEXT,
    "externalSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "audit" JSONB,

    CONSTRAINT "CheckoutOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckoutOrder_externalReference_key" ON "CheckoutOrder"("externalReference");
CREATE INDEX "CheckoutOrder_email_idx" ON "CheckoutOrder"("email");
CREATE INDEX "CheckoutOrder_status_idx" ON "CheckoutOrder"("status");
CREATE INDEX "CheckoutOrder_userId_idx" ON "CheckoutOrder"("userId");
CREATE INDEX "CheckoutOrder_planSlug_idx" ON "CheckoutOrder"("planSlug");
CREATE INDEX "CheckoutOrder_externalPaymentId_idx" ON "CheckoutOrder"("externalPaymentId");

ALTER TABLE "CheckoutOrder" ADD CONSTRAINT "CheckoutOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckoutOrder" ADD CONSTRAINT "CheckoutOrder_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7) AccessGrant — direito de acesso por E-MAIL (ASAAS | ADMIN_MANUAL)
-- ---------------------------------------------------------------------------
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

CREATE UNIQUE INDEX "AccessGrant_email_origin_externalPaymentId_key"
    ON "AccessGrant"("email", "origin", "externalPaymentId");
CREATE INDEX "AccessGrant_email_status_idx" ON "AccessGrant"("email", "status");
CREATE INDEX "AccessGrant_userId_status_idx" ON "AccessGrant"("userId", "status");

ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 8) FirstAccessToken — token opaco de uso único (apenas o hash é guardado)
-- ---------------------------------------------------------------------------
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

CREATE UNIQUE INDEX "FirstAccessToken_tokenHash_key" ON "FirstAccessToken"("tokenHash");
CREATE INDEX "FirstAccessToken_email_idx" ON "FirstAccessToken"("email");

ALTER TABLE "FirstAccessToken" ADD CONSTRAINT "FirstAccessToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 9) Rank/XP + Publicação + Automações + Growth (métricas reais do painel Admin)
-- ---------------------------------------------------------------------------

-- Estado de progressão do usuário (1:1).
CREATE TABLE "UserLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalXpEarned" INTEGER NOT NULL DEFAULT 0,
    "lastLevelUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserLevel_userId_key" ON "UserLevel"("userId");
CREATE INDEX "UserLevel_level_idx" ON "UserLevel"("level");
CREATE INDEX "UserLevel_xp_idx" ON "UserLevel"("xp");

ALTER TABLE "UserLevel" ADD CONSTRAINT "UserLevel_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Auditoria de concessão de XP (idempotente por userId+source+refId).
CREATE TABLE "XpLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XpLog_userId_source_refId_key" ON "XpLog"("userId", "source", "refId");
CREATE INDEX "XpLog_userId_createdAt_idx" ON "XpLog"("userId", "createdAt");
CREATE INDEX "XpLog_source_refId_idx" ON "XpLog"("source", "refId");

ALTER TABLE "XpLog" ADD CONSTRAINT "XpLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catálogo global de conquistas (badges).
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "unit" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");
CREATE INDEX "Achievement_active_idx" ON "Achievement"("active");

-- Conquista por usuário — progresso individual.
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "xpGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key"
    ON "UserAchievement"("userId", "achievementId");
CREATE INDEX "UserAchievement_userId_unlocked_idx" ON "UserAchievement"("userId", "unlocked");
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey"
    FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Log de operações de publicação (auditoria segura, sem tokens).
CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queueId" TEXT,
    "contentId" TEXT,
    "platform" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "externalId" TEXT,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublishLog_userId_createdAt_idx" ON "PublishLog"("userId", "createdAt");
CREATE INDEX "PublishLog_queueId_idx" ON "PublishLog"("queueId");
CREATE INDEX "PublishLog_platform_status_idx" ON "PublishLog"("platform", "status");

ALTER TABLE "PublishLog" ADD CONSTRAINT "PublishLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fundação de automações (nenhuma chamada real).
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "keywords" TEXT[],
    "action" TEXT NOT NULL DEFAULT 'dm',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_userId_enabled_idx" ON "AutomationRule"("userId", "enabled");

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evento de automação recebido (webhook futuro) — idempotente por eventId.
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationEvent_eventId_key" ON "AutomationEvent"("eventId");
CREATE INDEX "AutomationEvent_userId_createdAt_idx" ON "AutomationEvent"("userId", "createdAt");

ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Execução de automação — apenas registra avaliação, nunca ação externa.
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "eventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EVALUATED',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationExecution_userId_createdAt_idx" ON "AutomationExecution"("userId", "createdAt");

ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ação de crescimento recomendada (plano de ação operacional).
CREATE TABLE "GrowthAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "sourceSignal" TEXT,
    "sourceRecommendation" TEXT,
    "metricToWatch" TEXT,
    "baselineValue" DOUBLE PRECISION,
    "resultValue" DOUBLE PRECISION,
    "resultNote" TEXT,
    "xpGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthAction_userId_status_idx" ON "GrowthAction"("userId", "status");
CREATE INDEX "GrowthAction_userId_priority_idx" ON "GrowthAction"("userId", "priority");
CREATE INDEX "GrowthAction_userId_dueAt_idx" ON "GrowthAction"("userId", "dueAt");
CREATE INDEX "GrowthAction_sourceSignal_userId_idx" ON "GrowthAction"("sourceSignal", "userId");

ALTER TABLE "GrowthAction" ADD CONSTRAINT "GrowthAction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Passkey/WebAuthn — PREPARADO, não ativo. Nenhum dado biométrico.
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

CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");
CREATE INDEX "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");

ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 10) UserGoal — metas estratégicas (base do vínculo com conteúdo planejado)
-- ---------------------------------------------------------------------------
CREATE TABLE "UserGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserGoal_userId_status_idx" ON "UserGoal"("userId", "status");
CREATE INDEX "UserGoal_userId_category_idx" ON "UserGoal"("userId", "category");

ALTER TABLE "UserGoal" ADD CONSTRAINT "UserGoal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 10) PlannedContent — conteúdo planejado (relação com copy/ideia/draft/meta)
-- ---------------------------------------------------------------------------
CREATE TABLE "PlannedContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "format" TEXT NOT NULL DEFAULT 'reel',
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "notes" TEXT,
    "hypothesis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ideaId" TEXT,
    "copyId" TEXT,
    "draftId" TEXT,
    "goalId" TEXT,

    CONSTRAINT "PlannedContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlannedContent_userId_status_idx" ON "PlannedContent"("userId", "status");
CREATE INDEX "PlannedContent_userId_scheduledAt_idx" ON "PlannedContent"("userId", "scheduledAt");
CREATE INDEX "PlannedContent_userId_platform_idx" ON "PlannedContent"("userId", "platform");
CREATE INDEX "PlannedContent_ideaId_idx" ON "PlannedContent"("ideaId");
CREATE INDEX "PlannedContent_copyId_idx" ON "PlannedContent"("copyId");
CREATE INDEX "PlannedContent_goalId_idx" ON "PlannedContent"("goalId");

ALTER TABLE "PlannedContent" ADD CONSTRAINT "PlannedContent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedContent" ADD CONSTRAINT "PlannedContent_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedContent" ADD CONSTRAINT "PlannedContent_copyId_fkey"
    FOREIGN KEY ("copyId") REFERENCES "GeneratedCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedContent" ADD CONSTRAINT "PlannedContent_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "SocialDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedContent" ADD CONSTRAINT "PlannedContent_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "UserGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 11) PlannedContentExperiment — N:N conteúdo planejado × experimento
-- ---------------------------------------------------------------------------
CREATE TABLE "PlannedContentExperiment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedContentExperiment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlannedContentExperiment_contentId_experimentId_key"
    ON "PlannedContentExperiment"("contentId", "experimentId");
CREATE INDEX "PlannedContentExperiment_experimentId_idx"
    ON "PlannedContentExperiment"("experimentId");

ALTER TABLE "PlannedContentExperiment" ADD CONSTRAINT "PlannedContentExperiment_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "PlannedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedContentExperiment" ADD CONSTRAINT "PlannedContentExperiment_experimentId_fkey"
    FOREIGN KEY ("experimentId") REFERENCES "GrowthExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 12) ContentCopyVersion — versionamento da copy de um conteúdo
-- ---------------------------------------------------------------------------
CREATE TABLE "ContentCopyVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCopyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentCopyVersion_contentId_version_key"
    ON "ContentCopyVersion"("contentId", "version");
CREATE INDEX "ContentCopyVersion_userId_contentId_idx"
    ON "ContentCopyVersion"("userId", "contentId");

ALTER TABLE "ContentCopyVersion" ADD CONSTRAINT "ContentCopyVersion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCopyVersion" ADD CONSTRAINT "ContentCopyVersion_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "PlannedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 13) PublishQueue — fila de publicação (FK para PlannedContent, criada acima)
-- ---------------------------------------------------------------------------
CREATE TABLE "PublishQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "scheduledAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "externalId" TEXT,
    "provider" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublishQueue_contentId_platform_key" ON "PublishQueue"("contentId", "platform");
CREATE INDEX "PublishQueue_userId_status_idx" ON "PublishQueue"("userId", "status");
CREATE INDEX "PublishQueue_status_scheduledAt_idx" ON "PublishQueue"("status", "scheduledAt");
CREATE INDEX "PublishQueue_status_nextAttemptAt_idx" ON "PublishQueue"("status", "nextAttemptAt");

ALTER TABLE "PublishQueue" ADD CONSTRAINT "PublishQueue_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishQueue" ADD CONSTRAINT "PublishQueue_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "PlannedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 14) SystemSetting — configurações globais do admin (valores sensíveis
--     SEMPRE encriptados com AES-256-GCM antes de gravar)
-- ---------------------------------------------------------------------------
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");
