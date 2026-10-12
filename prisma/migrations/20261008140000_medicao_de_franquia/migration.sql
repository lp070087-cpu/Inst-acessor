-- ============================================================================
-- MEDIÇÃO DE FRANQUIA (usage metering) — models UsageEvent e UsageCounter
-- ============================================================================
-- 100% ADITIVA e IDEMPOTENTE. Cria DUAS tabelas novas; nenhuma existente é
-- tocada (nenhum DROP, DELETE, ALTER COLUMN).
--
-- Por quê: o Inst Acessor não tinha NENHUM medidor de consumo. Estas tabelas
-- sustentam o painel de consumo do usuário e o gate de franquia por plano.
--
-- Observação sobre a FK: as duas tabelas referenciam "User" (ON DELETE CASCADE,
-- igual às demais tabelas do projeto). Como "User" já existe, a FK é segura.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "UsageEvent" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "feature"        TEXT NOT NULL,
    "amount"         INTEGER NOT NULL DEFAULT 1,
    "origin"         TEXT,
    "idempotencyKey" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- Idempotência: um retry do mesmo evento externo não conta duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS "UsageEvent_idempotency_key_key"
    ON "UsageEvent"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "UsageEvent_userId_feature_createdAt_idx"
    ON "UsageEvent"("userId", "feature", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_userId_createdAt_idx"
    ON "UsageEvent"("userId", "createdAt");

ALTER TABLE "UsageEvent"
    ADD CONSTRAINT "UsageEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "UsageCounter" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "feature"   TEXT NOT NULL,
    "window"    TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "used"      INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- Um contador por (usuário, capacidade, janela, chave) — o upsert incrementa.
CREATE UNIQUE INDEX IF NOT EXISTS "UsageCounter_userId_feature_window_key_key"
    ON "UsageCounter"("userId", "feature", "window", "key");

CREATE INDEX IF NOT EXISTS "UsageCounter_userId_window_key_idx"
    ON "UsageCounter"("userId", "window", "key");

ALTER TABLE "UsageCounter"
    ADD CONSTRAINT "UsageCounter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
