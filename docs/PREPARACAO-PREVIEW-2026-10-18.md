# Atualização de estado — 19/10/2026

Esta seção prevalece sobre as descrições históricas de 18/10 abaixo. É uma preparação local; não comprova configuração ou publicação remota.

- **Identificação informada pelo proprietário:** equipe Vercel `lp070087-5894s-projects`; projeto atual `inst-acessor` é produção e não deve ser modificado; domínio de produção `unitrixapp.com.br` não deve ser usado como bancada. Projeto Neon informado como criado: `inst-acessor-preview`, separado do original. Essas informações humanas ainda precisam ser confrontadas com os IDs no painel autorizado.
- **Destino proposto:** projeto Vercel dedicado `inst-acessor-preview`. Sua existência, ID, equipe, domínios, proteção e integrações não foram comprovados. Não confundir nome proposto com recurso criado.
- **Autenticação pendente:** o navegador abriu a Vercel sem sessão autenticada; foi solicitado ao proprietário que faça login. Não houve alteração remota. Não enviar senhas, tokens ou URLs de conexão pelo chat.
- **Autorização atual:** commit/push após validar e publicação progressiva exclusivamente em Preview/Homologação isolado foram autorizados. Isso não autoriza tocar `inst-acessor`, produção, `main`, `preview-ajustes`, domínios reais, integrações de produto ou migrações externas. Antes de push, verificar se a integração Git poderá disparar deploy em projeto original; autorização para Preview isolado não abrange esse efeito.
- **Vínculo local:** `.audit-worktree/.vercel` não foi encontrado; `../.vercel` existe no checkout original. Somente a existência foi inspecionada, sem abrir configuração/credenciais. Nunca herdar ou copiar esse vínculo. Confirmar explicitamente equipe e ID do projeto novo antes de qualquer associação local ou deploy. CLI Vercel não foi encontrada nas dependências locais ou no PATH na verificação de 19/10; nenhum pacote foi instalado.
- **Banco:** faltam confirmação do ID do projeto Neon, branch, endpoint, banco e papel, além da correspondência entre conexão pooled e direta do mesmo destino. Não conectar ou aplicar schema por suposição. A cadeia local agora contém **11 migrações**, incluindo inbox social e snapshots de publicação; referências a nove migrações nos documentos anteriores são históricas. Migrações externas continuam proibidas. Sem schema isolado autorizado, o editor autenticado não pode ser declarado operacional; não criar bypass de autenticação para contornar essa dependência.
- **Configuração essencial, somente nomes:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_URL`, `SITE_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAIL`. `NEXTAUTH_URL` é derivada de `AUTH_URL` no build; `VERCEL_URL` e `NODE_ENV` são fornecidas pela hospedagem. Usar segredos exclusivos e nunca copiar variáveis do projeto original. Manter sem credenciais as integrações de produto e desativados os workers/schedulers: `PUBLISHING_WORKER_ENABLED`, `PUBLISHING_SCHEDULER_ENABLED`, `TIKTOK_WEBHOOK_INBOX_ENABLED`, `SOCIAL_WEBHOOK_WORKER_ENABLED`.
- **Implementação local evoluiu:** reconciliação administrativa auditável e seu painel já existem; há processo dedicado de scheduler desativado por padrão, inbox TikTok com handlers limitados e snapshots imutáveis de publicações. As descrições abaixo de ausência desses recursos retratam 18/10 antes das correções. Isso não significa que disparador/hospedagem, contratos de provedores ou operações externas estejam validados. Consultar `RETOMADA-FINALIZACAO-2026-10-19.md` e `SEGURANCA-E-CONTINUACAO-2026-10-19.md` para evidências e bloqueios atuais, preservando a distinção entre testes locais e integração real.

## Registro histórico de 18/10/2026

# Preparação do Preview — 18/10/2026

## Estado confirmado e escopo

Worktree: `C:\Users\55819\Desktop\Inst Acessor\.audit-worktree`. Branch: `audit/finalizacao-inst-acessor`. HEAD: `d7a2b1f4ec656bcbb0231d15079c48bb950e8e65`; base: `fcd81bbfca71a23aa2b050d12597fa55d4d7501d`. Árvore limpa antes desta documentação. O checkout original permanece em `preview-ajustes`, também sem alterações reportadas. Este documento é uma nova alteração local, não commitada.

Plano existente lido: `docs/PLANO-VALIDACAO-EXTERNA-E-DEPLOY.md`. Resultados anteriores reaproveitados de `docs/RESULTADO-VALIDACAO-LOCAL.md`; não foram repetidos auditoria, instalação, build ou matriz de testes. Foram feitas apenas leituras direcionadas do código e consulta de documentação pública. Nenhum `.env` foi lido, nenhuma conta foi acessada e nenhuma integração de produto foi chamada. Intelligence não iniciado.

**Pronto:** procedimento de Preview e entrega local no commit acima. **Ainda não comprovado:** configuração efetiva de Vercel, Neon, credenciais sandbox, permissões Meta e execução remota. Não existe aprovação de deploy neste documento.

## Vercel: configuração a preparar depois da autorização

Preferir projeto dedicado de validação, sem integrações/segredos herdados de produção. Escopar variáveis exclusivamente ao Preview e à branch autorizada. Definir domínio HTTPS estável para sessão, callbacks e webhooks. Confirmar projeto, equipe, custos e proteção antes de qualquer importação: conectar Git/push pode disparar deployments automáticos. Não executar isso agora.

Framework Next.js, lockfile existente e `npm run build`; gerar Prisma Client durante instalação/build, sem executar migrações nesse gancho. Não utilizar `prisma:migrate` nem `prisma:push`: os scripts apontam para operações inadequadas a este procedimento. O script genérico `lint` ainda usa `next lint`; aproveitar a validação documentada do wrapper, não presumir que esse script seja o gate correto no Next 15. Conferir versão Node suportada na hospedagem, duração de funções, conexões e armazenamento antes do build remoto.

Variáveis abaixo: somente nomes, sem valores ou modelos de credenciais.

| Grupo | Nomes | Condição |
|---|---|---|
| Banco | `DATABASE_URL`, `DIRECT_URL` | Exclusivas do banco descartável aprovado |
| Sessão e identidade | `AUTH_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAIL` | Segredos novos; administrador fictício exclusivo |
| URLs auxiliares | `NEXTAUTH_URL`, `SITE_URL` | Conferir consumidores; next.config deriva NEXTAUTH_URL de AUTH_URL durante build |
| Asaas | `ASAAS_ENV`, `ASAAS_BASE_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BILLING_TYPE` | Somente sandbox após aprovação das operações |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_SCOPES`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | App e contas de teste aprovados |
| Upload | `BLOB_READ_WRITE_TOKEN` | Store separado; sem acesso a arquivos reais |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` | Desativado inicialmente; depois caixa de teste aprovada |
| IA | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` | O último é fallback; ausentes inicialmente |
| Worker | `CRON_SECRET`, `PUBLISHING_WORKER_ENABLED` | Worker desativado inicialmente; segredo exclusivo |
| Marca opcional | `NEXT_PUBLIC_UNITRIXAPP_CNPJ` | Informação pública aprovada; não é segredo |

`VERCEL_URL` e `NODE_ENV` são fornecidas pelo ambiente. `NEXT_OUTPUT_DIR` é ajuste da bancada, dispensável no Preview normal. `META_APP_ID` e `META_APP_SECRET` são aliases legados: preferir o par Instagram, sem carregar pares conflitantes. Não configurar gateways legados nem TikTok nesta fase. TikTok mantém pendências operacionais; não declarar integração pronta.

Não há bloqueio global de saída incorporado ao Preview: o bloqueio do wrapper local não acompanha automaticamente a hospedagem. Desativar worker não desativa publicação manual, comentários ou Direct. Primeiro Preview: dados fictícios, acesso restrito e credenciais de provedores ausentes. Liberar credenciais somente por operação aprovada; isso exige controlar quem pode acionar as telas/rotas correspondentes.

## Neon: separação possível, ainda não provisionada

O datasource Prisma usa DATABASE_URL e DIRECT_URL; portanto suporta tecnicamente outro PostgreSQL sem alteração de código. Não foi acessado painel nem banco para comprovar isolamento real.

Criar posteriormente **projeto Neon dedicado com banco vazio**, sem derivação de dados de produção. Branch comum pode expor o estado e dados do pai; credenciais distintas não tornam dados copiados fictícios. Mesmo uma branch somente de schema exigiria revisão do histórico de migrações; banco vazio é a opção recomendada para esta baseline. Referência: [branching Neon](https://neon.com/docs/get-started-with-neon/workflow-primer).

Usar conexão com pool para aplicação e conexão direta para migrações, ambas do mesmo banco descartável. Conferir hostname, database, projeto/branch e papel autorizado antes de conectar; não registrar strings de conexão. Segredos novos, papéis sem acesso ao projeto de produção, nenhuma variável de produção como fallback, nenhuma integração automática que injete outro destino. Pool não é barreira de isolamento. Referência: [pool Neon](https://neon.com/docs/connect/connection-pooling).

## Migrações: procedimento futuro, não executado

Há nove diretórios de migração, começando em `20260901000000_baseline_historico` e terminando em `20261017190000_alinhamento_historico`. O relatório anterior registra bootstrap vazio, evolução com dado fictício preservado e ausência de drift; isso não comprova um banco Neon ainda inexistente. Migrações antigas não devem ser editadas.

1. Obter aprovação explícita para criar o recurso e aplicar migrações no destino descartável identificado. Confirmar banco vazio e alvo permitido; parar se houver tabelas, dados ou histórico inesperados.
2. Preparar processo separado com ambiente sanitizado e URLs injetadas explicitamente, sem `.env` original nem fallback. Rever SQL completo, privilégios e schema; gerar cliente a partir do schema deste commit.
3. No banco vazio aprovado, executar `prisma migrate deploy` com a cadeia completa. **Não marcar baseline como aplicada:** ela precisa criar os objetos. Não usar reset, db push, migrate dev nem seed não revisado.
4. Conferir `prisma migrate status`, histórico de aplicações e comparação do schema final; criar apenas fixtures sintéticas por procedimento revisado. Registrar resultados sem credenciais. Smoke test de leitura/escrita e isolamento somente nesse banco.
5. Se o destino já existir, interromper o procedimento: inspecionar histórico/drift mediante autorização específica. `migrate resolve` somente após prova de equivalência e plano próprio; não tratar baseline como correção universal.

Não incluir migração no build do Preview. Rollback inicial: retirar o Preview de circulação, desativar integrações/worker e recriar somente o banco descartável autorizado se necessário. Não executar SQL reverso destrutivo ou atingir produção.

## Asaas Sandbox e webhooks

Configuração verificada em `src/lib/billing/asaas/config.ts`: ASAAS_BASE_URL pode sobrescrever o destino independentemente de ASAAS_ENV; o código não impõe allow-list de host sandbox. Antes de disponibilizar chave, validar HTTPS, hostname e caminho efetivo para `https://api-sandbox.asaas.com/v3`, sem redirecionamento para produção. Essa conferência é um gate operacional pendente, não uma proteção já implementada.

Depois de aprovação específica, usar conta sandbox exclusiva, comprador fictício e webhook HTTPS estável em `/api/webhooks/asaas`. Token exclusivo do webhook, distinto da API key, conforme formato exigido pelo código. O receptor valida o header `asaas-access-token`; não usar segredo em query string. Cadastrar somente os eventos tratados pelo módulo de billing, após confrontar o parser com a lista disponível no sandbox. Referência: [webhooks Asaas](https://docs.asaas.com/docs/sobre-os-webhooks).

Resolver proteção da Vercel antes de registrar o webhook: provedor precisa alcançar a rota sem sessão de navegador, mantendo autenticação própria. Escolher mecanismo suportado e restrito; não presumir que Asaas envie headers arbitrários de bypass, nem desproteger todo o Preview. A viabilidade depende do plano e da política escolhidos. Referência: [Deployment Protection](https://vercel.com/docs/deployment-protection).

Testes posteriores autorizados: checkout hospedado, vínculo pedido/plano/preço, confirmação, renovação/recorrência, cancelamento, estorno, chargeback quando simulável, ordem invertida, evento repetido e reentrega após falha. Conferir uma única concessão/revogação de acesso e persistência auditável. São testes pendentes; nenhum checkout/cobrança/webhook externo foi criado agora.

## Meta/Instagram: lista preparada, execução bloqueada

Fluxo confirmado: **Instagram Login**, graph.instagram.com; não trocar pelas permissões de Facebook Login. Callback local implementado: `/api/integrations/instagram/callback`; webhook específico: `/api/webhooks/instagram`. A rota genérica `/api/webhooks/publishing` também existe; escolher subscriptions e receptor por tipo de evento, sem duplicar efeitos entre receptores.

Permissões solicitadas atualmente pelo código, sujeitas à concessão e à conferência no app:

| Permissão | Finalidade de teste |
|---|---|
| `instagram_business_basic` | Identidade e leitura básica |
| `instagram_business_manage_insights` | Métricas usadas pelo dashboard |
| `instagram_business_content_publish` | Publicação aprovada em conta de teste |
| `instagram_business_manage_comments` | Leitura/resposta/moderação de comentário de teste |
| `instagram_business_manage_messages` | Inbox, resposta e Comentário→Direct conforme elegibilidade |

INSTAGRAM_SCOPES permite override; comparar escopos solicitados com os efetivamente concedidos. A versão Graph tem default no código, mas suporte atual e compatibilidade devem ser confirmados antes do teste. Não houve confirmação oficial de todos os escopos nesta etapa: a [página oficial Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/) retornou HTTP 429 na consulta pública. A tabela comprova a solicitação no código, não App Review aprovado.

Preparar app de teste, conta profissional e usuários com papéis de teste aceitos; cadastrar callback HTTPS exato e domínio estável. Conferir requisitos atuais de acesso Standard/Advanced, App Review e verificação empresarial para o público pretendido; nenhuma aprovação foi presumida.

Após autorização: OAuth positivo/negado, state expirado/repetido, scopes ausentes, troca/renovação/revogação e desconexão; sync/perfil/métricas; upload e publicação única; agendamento/cancelamento; comentário manual/aprovação/automático; inbox/FAQ/Direct apenas para destinatários identificados, respeitando janelas e elegibilidade do provedor; challenge GET, assinatura POST inválida/válida, reentrega e duplicidade. Preservar IDs sanitizados, não tokens. Revogar conta de teste e remover artefatos aprovados ao encerrar.

## Scheduler e resultados incertos

Pronto no código: `/api/cron/publishing`, segredo Bearer comparado de forma constante, worker desativado por padrão, execução de um item por chamada, logs de duração/contagem e maxDuration declarado. Claim por proprietário/estado, cancelamento condicionado, consulta de status para externalId já salvo e quarentena de PROCESSANDO expirado após dez minutos existem. A quarentena é acionada ao rodar processQueue, não é um monitor independente.

Não foi encontrado vercel.json registrando agenda. A [documentação Vercel Cron](https://vercel.com/docs/cron-jobs) indica chamadas para o deployment de produção; não assumir execução automática em Preview. Para testar Preview futuramente: invocação autenticada controlada ou scheduler de teste separado, explicitamente aprovado, apontando exclusivamente ao Preview. Não cadastrar cron de produção nesta fase.

Falta definir frequência/capacidade, limite do plano, duração efetiva, alertas de backlog/falha/quarentena e responsável operacional. Um item por chamada pode limitar a vazão. Não foi feita prova de carga na hospedagem.

Sem ID externo e com resultado incerto, o item fica RECONCILIATION_REQUIRED sem retry automático. Isso reduz duplicação, mas não recupera sozinho o resultado. Falta fluxo operacional durável para consultar evidência do provedor, associar ID confirmado, concluir publicação/medição e reconciliar registros locais com trilha auditável; ausência remota precisa ser demonstrada antes de autorizar novo envio. Também faltam provas externas de crash entre efeito remoto e persistência local. Nunca limpar a quarentena ou reenviar às cegas. Esses pontos bloqueiam ativação autônoma ampla, não a disponibilização de um Preview restrito com worker desligado.

## Checklist curto, em ordem

1. Aprovar projeto Vercel, domínio, custo, proteção e commit exato; manter main/preview-ajustes fora da operação.
2. Autorizar criação de projeto/banco Neon vazio e separado; conferir alvo e credenciais sem produção.
3. Configurar somente variáveis Preview aprovadas; credenciais externas ausentes, worker/email desligados e store separado se upload for incluído.
4. Autorizar e executar a cadeia de migrações no banco descartável, fora do build; validar histórico/schema e fixtures fictícias.
5. Revisar configuração final, proteção de rotas/webhooks e plano de retirada. Obter **aprovação explícita de deploy Preview** antes de publicar/push conectado.
6. Após deploy aprovado, smoke test pequeno: sessão, isolamento, permissões, leitura/escrita fictícia e logs sem segredos. Não repetir a matriz inteira sem falha ou alteração concreta.
7. Autorizar separadamente Asaas/Meta/Blob/IA/email com contas, destinos, operações e teto de custo. Configurar/testar somente o escopo aprovado.
8. Resolver scheduler/reconciliação antes de ativar automações. Apresentar evidências e pendências; produção/merge continuam exigindo nova aprovação.

**Autorizações faltantes:** criação/configuração dos recursos externos, migração no banco descartável identificado, push se necessário, deploy Preview, cadastro de callbacks/webhooks e cada operação externa de teste. **Configurações faltantes:** projetos/contas/domínio, política de proteção, segredos próprios, destino de banco, permissões Meta e orçamento. Nenhuma dessas ações foi executada ou autorizada implicitamente por esta preparação.
# Projeto criado — confirmação posterior em 19/10/2026

## Neon confirmado após login — somente metadados

O proprietário concluiu o login e autorizou identificação, sem migrações. Na organização `org-plain-sea-60643190`, a lista mostra o projeto de homologação separado do projeto `inst-acessor`. Foram abertos somente os metadados do projeto de homologação:

| Campo | Identificador observado |
|---|---|
| Nome exibido no console | `Nome: inst-acessor-preview` |
| Projeto | `winter-queen-11288843` |
| Região | AWS South America East 1 (São Paulo) |
| Branch padrão | `production` |
| Branch ID | `br-summer-cake-b6dp3hnt` |
| Banco | `neondb` |
| Proprietário mostrado | `neondb_owner` |
| Compute primário | `ep-muddy-resonance-b6dt5n2n` |
| Estado do compute | `SUSPENDED` na consulta |
| Versão PostgreSQL | 18, conforme painel |

A lista de projetos também identifica `inst-acessor` com ID distinto `holy-feather-42475386`; esse projeto não foi aberto nem alterado. O nome `production` acima é a branch padrão **do projeto separado de homologação**, não autorização de acesso à produção do aplicativo. Nenhum nome foi alterado. Identificar sempre projeto+branch IDs; não decidir o destino apenas pelo nome da branch ou pelo banco genérico `neondb`.

Comprovado: recursos separados no plano de controle Neon. Não comprovado: schema vazio, histórico Prisma, permissões efetivas da role, domínio/TLS e correspondência das conexões pool/direct, ausência de dados importados, ou isolamento da aplicação em runtime. Indicadores de uso zero não comprovam schema vazio. Não foi aberto o botão Connect, exibida senha/URL de conexão, iniciada conexão PostgreSQL, executado SQL ou migração, nem acordado manualmente o compute.

Destino candidato para futura autorização específica: projeto `winter-queen-11288843` / branch `br-summer-cake-b6dp3hnt` / banco `neondb`. Antes de qualquer bootstrap: conferir endpoint direto/pool sem expor credenciais, comprovar o destino efetivo e inspecionar schema/histórico em leitura autorizada; interromper se houver conteúdo inesperado. Aplicar as onze migrações somente após autorização expressa futura. Não usar `resolve` da baseline nem `db push` como atalho e não executar migração no build.

O projeto Vercel isolado continua sem banco/configuração operacional. Não foram adicionadas variáveis com conexões ainda não verificadas. A autenticação Neon antes indicada como pendente nas seções históricas foi resolvida; schema e migrações continuam pendentes por escopo explícito do proprietário.

O login foi concluído pelo proprietário. A equipe `lp070087-5894s-projects` foi confirmada no painel e o projeto vazio foi criado e renomeado para **inst-acessor-preview**, ID `prj_dQV5VfpVcDf0SroSxqz9ec4ytgkW`. Painel: https://vercel.com/lp070087-5894s-projects/inst-acessor-preview . A criação inicial atribuiu o nome automático `project-absg0`; trata-se do mesmo ID, não de um segundo projeto.

Verificado no projeto novo: nenhum deployment Production ou Preview, nenhum Git conectado, nenhuma variável própria adicionada e nenhuma variável compartilhada vinculada. Autenticação Vercel está habilitada em Standard Protection; sourcemaps protegidos. Nenhuma exceção ou segredo de bypass foi criado. A preferência de uso dos dados do projeto para treinamento foi desabilitada e o painel confirmou a gravação. Nenhuma configuração do projeto original foi copiada ou modificada.

A página de domínios mostra somente o endereço automático `project-absg0.vercel.app`, rotulado Production no projeto vazio; não é URL de Preview validado nem deployment do aplicativo. O domínio `unitrixapp.com.br` não foi vinculado. Não conectar Git ou fazer primeiro deploy antes de conferir o pacote, o commit validado, variáveis exclusivas e destino do banco. O projeto existe, mas o ambiente de homologação do aplicativo ainda não está operacional.

O Neon abriu no login; foi solicitada autenticação para consultar apenas identificadores de `inst-acessor-preview`. Projeto/branch/endpoint/banco/role/schema e correspondência pool/direct continuam pendentes. Nenhuma conexão PostgreSQL externa ou migração foi executada. As seções anteriores que ainda indicam Vercel não criado/login pendente são histórico superado por esta confirmação.
