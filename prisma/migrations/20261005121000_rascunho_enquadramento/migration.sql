-- ENQUADRAMENTO DO RASCUNHO — coluna para o recorte do preview
-- ============================================================
-- Migration ADITIVA e IDEMPOTENTE. Nenhum DROP, nenhum DELETE, nenhum dado
-- existente é alterado. A coluna entra como NULL para todas as linhas atuais,
-- e `null` já é o valor correto ("sem enquadramento escolhido" = neutro).
--
-- Contexto: o enquadramento (zoom + posição) do Preview Social vivia só no
-- estado da tela — salvar o rascunho e reabrir, ou dar F5, perdia a escolha.
--
-- LIMITE DECLARADO: esta coluna guarda a INTENÇÃO de enquadramento para o
-- preview. O arquivo enviado ao Instagram continua sendo o ORIGINAL; aplicar o
-- recorte ao binário exigiria renderização/transcodificação — etapa separada,
-- não implementada aqui.
--
-- ⚠️ NÃO APLICADA. Criada localmente para revisão.

ALTER TABLE "SocialDraft"
  ADD COLUMN IF NOT EXISTS "framing" TEXT;
