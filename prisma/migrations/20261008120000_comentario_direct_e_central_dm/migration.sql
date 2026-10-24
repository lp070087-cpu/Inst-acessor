-- COMENTÁRIO → DIRECT + CENTRAL DE DM (Instagram)
-- ===============================================
-- Migration ADITIVA e IDEMPOTENTE. Nenhum DROP, nenhum DELETE, nenhuma coluna
-- existente é alterada, nenhum dado atual é tocado. Cria SEIS tabelas novas e
-- seus índices/constraints.
--
-- Contexto: o Inst Acessor ganha duas capacidades que reutilizam a MESMA
-- `SocialConnection` e o MESMO token criptografado do Instagram Business Login
-- (nenhum segundo OAuth):
--
--   1. Comentário → Direct: comentário que casa um gatilho → mensagem PRIVADA
--      (private reply) no Direct da pessoa.
--   2. Central de DM: threads e mensagens REAIS lidas dos endpoints oficiais da
--      Meta, para o painel de conversas.
--
-- ⚠️ NÃO APLICADA. Criada localmente para revisão. Antes de aplicar:
--     npx prisma migrate deploy     (em ambiente controlado)
--
-- Isolamento por usuário: toda tabela tem `userId` com FK para "User" com
-- ON DELETE CASCADE. A API SEMPRE filtra por `userId` da sessão.

-- ---------------------------------------------------------------- CommentDirectRule
CREATE TABLE IF NOT EXISTS "comment_direct_rule" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "enabled"      BOOLEAN      NOT NULL DEFAULT false,
    "platform"     TEXT         NOT NULL DEFAULT 'instagram',
    "mediaId"      TEXT,
    "mediaCaption" TEXT,
    "scope"        TEXT         NOT NULL DEFAULT 'all',
    "triggerType"  TEXT         NOT NULL,
    "triggerTerms" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "messageText"  TEXT         NOT NULL,
    "dailyLimit"   INTEGER      NOT NULL DEFAULT 50,
    "onePerUser"   BOOLEAN      NOT NULL DEFAULT true,
    "pausedUntil"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_direct_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "comment_direct_rule_userId_enabled_idx"
    ON "comment_direct_rule"("userId", "enabled");
CREATE INDEX IF NOT EXISTS "comment_direct_rule_userId_mediaId_idx"
    ON "comment_direct_rule"("userId", "mediaId");

-- ---------------------------------------------------------------- CommentDirectLog
-- `@@unique([mediaId, commentId])` é o coração da idempotência: a Meta reentrega
-- o mesmo webhook e, sem esta constraint, a mesma pessoa receberia duas DMs.
CREATE TABLE IF NOT EXISTS "comment_direct_log" (
    "id"                 TEXT         NOT NULL,
    "userId"             TEXT         NOT NULL,
    "socialConnectionId" TEXT         NOT NULL,
    "ruleId"             TEXT,
    "mediaId"            TEXT         NOT NULL,
    "commentId"          TEXT         NOT NULL,
    "commenterId"        TEXT,
    "commenterUsername"  TEXT,
    "originalComment"    TEXT         NOT NULL,
    "matchedTrigger"     TEXT,
    "sentMessage"        TEXT,
    "status"             TEXT         NOT NULL DEFAULT 'PENDING',
    "reason"             TEXT,
    "externalMessageId"  TEXT,
    "errorCode"          TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"             TIMESTAMP(3),

    CONSTRAINT "comment_direct_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "comment_direct_log_mediaId_commentId_key"
    ON "comment_direct_log"("mediaId", "commentId");
CREATE INDEX IF NOT EXISTS "comment_direct_log_userId_status_idx"
    ON "comment_direct_log"("userId", "status");
CREATE INDEX IF NOT EXISTS "comment_direct_log_userId_createdAt_idx"
    ON "comment_direct_log"("userId", "createdAt");

-- ---------------------------------------------------------------- DirectConversation
CREATE TABLE IF NOT EXISTS "direct_conversation" (
    "id"                  TEXT         NOT NULL,
    "userId"              TEXT         NOT NULL,
    "socialConnectionId"  TEXT         NOT NULL,
    "igConversationId"    TEXT         NOT NULL,
    "participantId"       TEXT,
    "participantUsername" TEXT,
    "participantName"     TEXT,
    "lastMessageAt"       TIMESTAMP(3),
    "unreadCount"         INTEGER,
    "lastMessagePreview"  TEXT,
    "windowOpen"          BOOLEAN,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "direct_conversation_igConversationId_key"
    ON "direct_conversation"("igConversationId");
CREATE INDEX IF NOT EXISTS "direct_conversation_userId_lastMessageAt_idx"
    ON "direct_conversation"("userId", "lastMessageAt");

-- ---------------------------------------------------------------- DirectMessage
CREATE TABLE IF NOT EXISTS "direct_message" (
    "id"             TEXT         NOT NULL,
    "userId"         TEXT         NOT NULL,
    "conversationId" TEXT         NOT NULL,
    "igMessageId"    TEXT         NOT NULL,
    "direction"      TEXT         NOT NULL DEFAULT 'INBOUND',
    "text"           TEXT,
    "attachmentType" TEXT,
    "sentAt"         TIMESTAMP(3),
    "fromUs"         BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "direct_message_igMessageId_key"
    ON "direct_message"("igMessageId");
CREATE INDEX IF NOT EXISTS "direct_message_conversationId_sentAt_idx"
    ON "direct_message"("conversationId", "sentAt");
CREATE INDEX IF NOT EXISTS "direct_message_userId_sentAt_idx"
    ON "direct_message"("userId", "sentAt");

-- ---------------------------------------------------------------- DirectFaq
CREATE TABLE IF NOT EXISTS "direct_faq" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "question"  TEXT         NOT NULL,
    "answer"    TEXT         NOT NULL,
    "keywords"  TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "category"  TEXT         NOT NULL DEFAULT 'geral',
    "active"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_faq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "direct_faq_userId_active_idx"
    ON "direct_faq"("userId", "active");

-- ---------------------------------------------------------------- DirectAgentAction
CREATE TABLE IF NOT EXISTS "direct_agent_action" (
    "id"             TEXT         NOT NULL,
    "userId"         TEXT         NOT NULL,
    "conversationId" TEXT,
    "messageId"      TEXT,
    "action"         TEXT         NOT NULL,
    "suggestion"     TEXT,
    "finalText"      TEXT,
    "reason"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_agent_action_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "direct_agent_action_userId_createdAt_idx"
    ON "direct_agent_action"("userId", "createdAt");

-- ---------------------------------------------------------------- Foreign keys
-- Blocos idempotentes: só adicionam a constraint se ela ainda não existir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_direct_rule_userId_fkey') THEN
        ALTER TABLE "comment_direct_rule" ADD CONSTRAINT "comment_direct_rule_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_direct_log_userId_fkey') THEN
        ALTER TABLE "comment_direct_log" ADD CONSTRAINT "comment_direct_log_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_direct_log_socialConnectionId_fkey') THEN
        ALTER TABLE "comment_direct_log" ADD CONSTRAINT "comment_direct_log_socialConnectionId_fkey"
            FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_conversation_userId_fkey') THEN
        ALTER TABLE "direct_conversation" ADD CONSTRAINT "direct_conversation_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_message_userId_fkey') THEN
        ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_message_conversationId_fkey') THEN
        ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_conversationId_fkey"
            FOREIGN KEY ("conversationId") REFERENCES "direct_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_faq_userId_fkey') THEN
        ALTER TABLE "direct_faq" ADD CONSTRAINT "direct_faq_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_agent_action_userId_fkey') THEN
        ALTER TABLE "direct_agent_action" ADD CONSTRAINT "direct_agent_action_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
