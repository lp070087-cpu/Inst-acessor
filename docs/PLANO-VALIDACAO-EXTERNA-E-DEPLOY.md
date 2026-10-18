# Plano de validação externa e deploy — exige aprovação

Este documento prepara a próxima etapa. Nenhuma operação externa descrita abaixo foi realizada nem está autorizada por sua existência.

## Autorização necessária para testar integrações

| Serviço | Destino permitido proposto | Operações | Dados/custo/limpeza |
|---|---|---|---|
| Asaas | Somente `api-sandbox.asaas.com`, conta sandbox identificada pelo proprietário | Criar comprador fictício e checkout; simular confirmação/recorrência/estorno; reentregar webhook para preview exclusivo | Valores fictícios; sem cartão ou CPF real; cancelar fixtures ao terminar somente com escopo autorizado |
| Meta Instagram | App e conta profissional exclusivamente de teste, explicitamente identificados | OAuth/scopes/refresh/revogação, sync, uma publicação identificada como teste, comentário e DM a conta de teste | Nenhum seguidor/cliente real; aprovar texto/mídia/destinatários e posterior remoção antes dos efeitos |
| TikTok | App e conta de teste aprovados | OAuth/sync/status; publicação apenas após aprovação de mídia e conta | Webhook não deve ser apresentado como operacional enquanto não houver processamento durável |
| IA | Projeto/chave de teste e modelo autorizados | Casos determinísticos de geração, timeout, erro, JSON inválido e limite | Teto proposto de gasto: R$ 5,00; ajustar apenas com autorização explícita. Nunca usar dados pessoais reais |
| Email | Caixa de teste explicitamente fornecida | Primeiro acesso e acesso liberado | Teto proposto de dez emails de teste; não enviar para clientes |
| Dispositivos | iPhone/iPad e Android disponíveis, sessões de teste | Safari/Chrome, teclado, safe area, PWA, retorno OAuth e arquivo da galeria | Sem contas pessoais ou login real |

Antes de executar: o usuário precisa identificar as contas, destinatários e aprovar os efeitos/custos. Validar hostname e ambiente efetivos; a etiqueta “sandbox” não basta. Registrar resultados com IDs sanitizados, nunca chaves, senhas, cookies, tokens ou dados pessoais. Não usar produção para diagnosticar conectividade.

## Gates antes de solicitar deploy

1. Branch/diff revisados; testes locais aprovados e limitações documentadas.
2. Migrações: revisar baseline histórica e diferenças de schema. O banco de produção não foi consultado. Nunca aplicar automaticamente a nova baseline a banco existente; preparar primeiro plano de baseline/resolve para staging descartável autorizado e verificar `_prisma_migrations`, tabelas, colunas e índices. Não alterar checksums de migrações antigas.
3. Validar integrações externas na conta de teste e obter evidências de callback/webhook real. Confirmar App Review e permissões concedidas.
4. Conferir política de admin único (`ADMIN_EMAIL` substitui o padrão), identidade de contas históricas e necessidade de novo login após revogação por versão de senha.
5. Conferir política comercial: franquias permanecem em medição; cron e efeitos externos desativados por padrão. Aprovar qualquer ativação separadamente.
6. Rever o modo best-effort de notificações pós-commit: falha de email não desfaz o acesso pago. Entrega garantida exige outbox durável/reprocessamento observável antes de prometer esse SLA.
7. Definir limites do plano Vercel, duração das funções, frequência do cron, URLs de callbacks e webhook, pool Neon e armazenamento de mídia. Não inventar configuração real a partir do código.

## Variáveis a conferir — somente nomes

`DATABASE_URL`, `DIRECT_URL`, `AUTH_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ASAAS_ENV`, `ASAAS_BASE_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_SCOPES`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `PUBLISHING_WORKER_ENABLED`.

Conferir nomes efetivamente utilizados pelo código no momento do rollout. Nunca copiar o arquivo `.env` de produção para uma bancada. Chave de criptografia precisa permanecer compatível com credenciais já cifradas.

## Rollout proposto, ainda não autorizado

1. Backup verificado e plano de restauração do banco/Blob; registrar referência Git e versão anterior de deploy sem expor segredos.
2. Criar preview dedicado com banco e credenciais de teste, sem herdar configurações de produção. Rodar smoke tests, integrações e dispositivos aprovados.
3. Apresentar resultado concreto, SQL revisado, alterações de configuração e efeitos externos para aprovação explícita do proprietário.
4. Somente após aprovação: aplicar migração revisada, deploy e smoke tests controlados. Ativar cron em etapa separada e observar fila/logs/latência/erros.

## Rollback proposto

- Reverter para deploy anterior e desativar worker/novos efeitos externos antes de investigar.
- Não apagar eventos, grants ou filas para “corrigir” duplicidade. Manter registros e reconciliar por IDs do provedor.
- Migrações aditivas não devem ser desfeitas com DROP em emergência. Restaurar backup somente com aprovação, janela e impacto explícitos; preferir correção aditiva.
- Se publicação/DM tiver resultado incerto, manter em conferência; nunca reenviar automaticamente durante rollback.
- Confirmar que tokens cifrados continuam legíveis e que sessões antigas exigem novo login conforme a mudança de autenticação.
