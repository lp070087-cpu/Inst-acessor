# Neon Preview: preparação e identificação, sem conexão PostgreSQL

Destino conferido em metadados do console em 19/10/2026: projeto `winter-queen-11288843`, nome exibido `Nome: inst-acessor-preview`, São Paulo, plano gratuito; branch padrão `production` (`br-summer-cake-b6dp3hnt`), banco `neondb`, owner `neondb_owner`, compute `ep-muddy-resonance-b6dt5n2n` suspenso. É projeto distinto de `inst-acessor` (`holy-feather-42475386`), visto somente na lista de projetos. Worktree `.audit-worktree`, branch `audit/finalizacao-inst-acessor`. Nenhuma conexão PostgreSQL ou migração foi executada. Separação de projetos comprovada não valida schema, permissões da role ou conexões pool/direct. Este documento complementa `PREPARACAO-PREVIEW-2026-10-18.md` e `PLANO-VALIDACAO-EXTERNA-E-DEPLOY.md`.

## Configurar segredos somente localmente

Foi criado `.env.preview-neon.local`, inicialmente vazio e coberto pela regra `.env*` do Git. Não substituir `.env`/`.env.local`, não copiar arquivos existentes e não usar variáveis herdadas como fallback. Este arquivo propositalmente não é carregado automaticamente pelo Next.js ou pelo Prisma. Não iniciar aplicação, Studio ou CLI de banco nesta etapa.

No painel Neon, selecione explicitamente o projeto **inst-acessor-preview**. Na opção de conexão, selecione a branch, o banco e o papel exclusivos desse projeto. Copie a string com pooling para `DATABASE_URL` e a string sem pooling para `DIRECT_URL`, diretamente no editor local. Preserve os parâmetros TLS fornecidos. Nunca cole URLs no chat, terminal, documentação ou logs; evite capturas de tela com segredos.

Antes de qualquer conexão, conferir no painel e localmente, sem exibir URLs:

- ID do projeto corresponde ao novo `inst-acessor-preview`; região São Paulo; projeto criado independentemente, sem restauração/cópia do original.
- Registrar apenas ID do novo projeto, branch, endpoint, nome do banco e role para identificar o alvo da aprovação. Não consultar credenciais do projeto original.
- Host direto corresponde ao endpoint mostrado nesse projeto; host pooled corresponde ao mesmo endpoint com o sufixo de pool. As duas URLs usam o mesmo banco e role. Não inferir o nome do projeto pelo hostname.
- Destino não é o projeto original: comprovar a seleção e o ID do projeto novo no painel. Caso a identidade permaneça ambígua, interromper. URLs preenchidas não constituem aprovação nem prova de isolamento.

## Procedimento preparado para execução futura

1. Solicitar aprovação específica para **conexão somente de leitura** ao projeto/ID, branch, endpoint e banco identificados acima. Confirmar tabelas e histórico de migrações; parar se houver objetos/dados inesperados. Até essa aprovação, nem `migrate status` deve ser executado.
2. Após confirmar banco vazio, apresentar esse resultado e solicitar aprovação específica para **aplicar as onze migrações existentes** nesse destino. Não executar como parte da autorização de leitura. Recontar o histórico se o código mudar antes da aprovação; a contagem antiga de nove foi superada pelas duas migrações aditivas de inbox TikTok e snapshots.
3. Preparar uma pasta temporária isolada contendo cópia do schema e de `prisma/migrations`, sem `.env` ou credenciais originais. Usar a CLI Prisma já instalada no worktree, sem `npx` que possa baixar pacotes. Em processo separado, remover variáveis de banco herdadas e injetar explicitamente apenas as duas URLs do arquivo dedicado; não imprimir ambiente, URLs ou saída bruta que possa conter segredos. Não carregar outros arquivos de ambiente. Conferir novamente o alvo antes da execução.
4. Com aprovação de escrita, executar a CLI local com os argumentos `migrate deploy --schema <schema-isolado>` no diretório isolado. A baseline deve criar os objetos; não usar `migrate resolve`, `migrate dev`, `db push`, reset ou seed. Não editar migrações antigas. O script `prisma:migrate` atual não serve para este procedimento.
5. Conferir status, histórico e schema no mesmo alvo autorizado, com saída sanitizada. Fixtures e smoke tests de escrita exigem escopo próprio. Não incluir migração no build Vercel.

## Próxima etapa Vercel

Projeto Vercel dedicado já criado: `inst-acessor-preview`, ID `prj_dQV5VfpVcDf0SroSxqz9ec4ytgkW`, equipe `lp070087-5894s-projects`; sem Git, deployments ou variáveis vinculadas na conferência. Antes de conectar Git, confirmar commit validado e política de deploy automático da branch `audit/finalizacao-inst-acessor`. Configurar as URLs novas somente no escopo Preview e na branch autorizada, segredos de sessão/criptografia novos e acesso restrito, sem importar segredos/integrações do projeto original. Manter worker desligado e credenciais externas ausentes. Asaas permanece o gateway oficial; sandbox somente em etapa aprovada. Push após validação e deploy isolado foram autorizados pelo proprietário; a falta de validação final e schema confirmado ainda bloqueia a publicação do aplicativo. Migrações externas continuam proibidas nesta etapa.
