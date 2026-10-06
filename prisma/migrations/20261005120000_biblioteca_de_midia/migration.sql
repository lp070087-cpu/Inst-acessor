-- BIBLIOTECA DE MÍDIA — tabela dos arquivos enviados pelo usuário
-- ==============================================================
-- Migration ADITIVA e IDEMPOTENTE. Nenhum DROP, nenhum DELETE, nenhuma coluna
-- existente é alterada, nenhum dado atual é tocado. Cria UMA tabela nova e o
-- índice da consulta de listagem.
--
-- Contexto: o binário fica no Vercel Blob; esta tabela guarda a REFERÊNCIA
-- (url pública + pathname no Blob) para que o arquivo enviado uma vez possa ser
-- reaproveitado em vários conteúdos, em vez de reenviado a cada rascunho.
--
-- ⚠️ NÃO APLICADA. Criada localmente para revisão. Antes de aplicar:
--     npx prisma migrate deploy     (em ambiente controlado)
--
-- Isolamento por usuário: `userId` tem FK para "User" com ON DELETE CASCADE —
-- apagar o usuário leva os registros dele; um usuário nunca consulta o de outro
-- (a API sempre filtra por `userId` da sessão).

CREATE TABLE IF NOT EXISTS "media_asset" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "url"          TEXT         NOT NULL,
    "pathname"     TEXT,
    "type"         TEXT         NOT NULL,
    "mimeType"     TEXT,
    "size"         INTEGER,
    "originalName" TEXT,
    "title"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- Índice da consulta real da tela: sempre por usuário, ordenado por data de
-- envio (a paginação por cursor usa a mesma ordem).
CREATE INDEX IF NOT EXISTS "media_asset_userId_createdAt_idx"
    ON "media_asset"("userId", "createdAt");

-- FK com CASCADE. O bloco abaixo é idempotente: só adiciona se ainda não existir,
-- para que reaplicar a migration não falhe com "constraint already exists".
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'media_asset_userId_fkey'
    ) THEN
        ALTER TABLE "media_asset"
            ADD CONSTRAINT "media_asset_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
