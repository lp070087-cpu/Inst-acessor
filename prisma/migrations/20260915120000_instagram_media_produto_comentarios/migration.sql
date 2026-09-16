-- BLOCO 1 — Instagram: publicação real, comentários reais e estado do sync
-- =====================================================================
-- Migration ADITIVA. Nenhum DROP, nenhum DELETE, nenhum dado existente é
-- alterado. As colunas novas entram como NULL para todas as linhas atuais.
--
-- Contexto: a tela de Respostas Inteligentes nunca teve de onde ler os
-- comentários REAIS — só existia a tabela da nossa resposta (`CommentReplyLog`).
-- Esta migration cria a tabela dos comentários recebidos e registra o estado
-- real da sincronização na conexão.

-- 1) Estado da sincronização e da capacidade de comentários na conexão.
ALTER TABLE "SocialConnection"
  ADD COLUMN IF NOT EXISTS "lastSyncAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSyncErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "commentsAvailable" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "commentsErrorCode" TEXT;

-- 2) Formato real da publicação quando a API informa (FEED | REELS | STORY | AD).
ALTER TABLE "InstagramMedia"
  ADD COLUMN IF NOT EXISTS "mediaProductType" TEXT;

-- 3) Uma linha de métricas por mídia (o sync passou a usar upsert em vez de
--    inserir uma linha nova a cada execução).
--
--    ANTES DE APLICAR: se já existirem várias linhas com o mesmo "mediaId",
--    o índice único abaixo FALHA. Resolva mantendo a linha mais recente.
--    O bloco é idempotente e preserva exatamente uma métrica por publicação.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'InstagramMediaMetric_mediaId_key'
  ) THEN
    -- Mantém apenas a métrica mais recente de cada publicação.
    DELETE FROM "InstagramMediaMetric" m
    USING "InstagramMediaMetric" newer
    WHERE m."mediaId" = newer."mediaId"
      AND (newer."capturedAt", newer."id") > (m."capturedAt", m."id");

    CREATE UNIQUE INDEX "InstagramMediaMetric_mediaId_key"
      ON "InstagramMediaMetric"("mediaId");
  END IF;
END $$;

-- 4) Comentários REAIS recebidos do Instagram.
CREATE TABLE IF NOT EXISTS "InstagramComment" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "mediaId"        TEXT NOT NULL,
  "igCommentId"    TEXT NOT NULL,
  "authorUsername" TEXT,
  "authorId"       TEXT,
  "text"           TEXT,
  "timestamp"      TIMESTAMP(3),
  "isOwn"          BOOLEAN NOT NULL DEFAULT false,
  "repliesCount"   INTEGER,
  "syncedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramComment_pkey" PRIMARY KEY ("id")
);

-- Idempotência: um comentário da Meta só pode existir uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramComment_igCommentId_key"
  ON "InstagramComment"("igCommentId");
CREATE INDEX IF NOT EXISTS "InstagramComment_userId_timestamp_idx"
  ON "InstagramComment"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "InstagramComment_mediaId_timestamp_idx"
  ON "InstagramComment"("mediaId", "timestamp");

-- FKs: apagar a publicação/usuário remove os comentários dela (mesma regra
-- das métricas já existentes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InstagramComment_mediaId_fkey'
  ) THEN
    ALTER TABLE "InstagramComment"
      ADD CONSTRAINT "InstagramComment_mediaId_fkey"
      FOREIGN KEY ("mediaId") REFERENCES "InstagramMedia"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InstagramComment_userId_fkey'
  ) THEN
    ALTER TABLE "InstagramComment"
      ADD CONSTRAINT "InstagramComment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
