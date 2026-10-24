-- ============================================================================
-- LISTA DE ESPERA — capacidade de vendas (model WaitlistEntry)
-- ============================================================================
-- ⚠️ NÃO APLICADA. Criada localmente para revisão do DONO.
-- Aplicar manualmente:  npx prisma migrate deploy   (ou `db push` no fluxo padrão)
--
-- 100% ADITIVA e IDEMPOTENTE:
--   - Cria UMA tabela nova (nenhuma existente é tocada).
--   - Nenhum DROP, nenhum DELETE, nenhuma coluna existente é alterada.
--   - Nenhuma FK para tabelas existentes (a identidade é o e-mail), então a
--     criação não depende de ordem nem de dados.
--
-- Contexto: capacidade de vendas (teto de pagantes + vendas abertas/fechadas,
-- configuradas pelo admin em `SystemSetting` key `billing.capacity.v1`) e a
-- lista de espera pública que substitui a compra quando não há vaga.
--
-- `email` é a chave de identidade (@unique): entrar duas vezes é idempotente.
-- `status`: WAITING | INVITED | CONVERTED | EXPIRED. Um convite vigente
-- (status='INVITED' com expiresAt no futuro) SEGURA uma vaga, permitindo ao
-- admin liberar uma vaga específica com a loja lotada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id"          TEXT NOT NULL,
    "name"        TEXT,
    "email"       TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'WAITING',
    "invitedAt"   TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3),
    "notes"       TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- Idempotência por e-mail normalizado.
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_email_key"
    ON "WaitlistEntry"("email");

-- Contagem por status (painel) e convites vigentes (reserva de vaga).
CREATE INDEX IF NOT EXISTS "WaitlistEntry_status_idx"
    ON "WaitlistEntry"("status");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_status_expiresAt_idx"
    ON "WaitlistEntry"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_createdAt_idx"
    ON "WaitlistEntry"("createdAt");
