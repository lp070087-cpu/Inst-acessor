# Plano de validação externa e deploy — exige aprovação

## Inventário confirmado em 19/10/2026 — estado atual

### Atualização de autorizações e painéis — 20/10/2026

#### Alternativa à limitação de RAM — GitHub Actions e migração manual separada

Preparação implementada, **não executada remotamente**. Nenhum novo teste pesado local, push, secret GitHub, migração ou deploy nesta rodada.

**CI sem credenciais de produto:** `.github/workflows/verify.yml` usa `ubuntu-24.04`, Node 24, máximo de 90 minutos, uma execução por ref e etapas sequenciais. Checa capacidade livre mínima de 2 GiB antes da instalação. Permissão somente contents/read e checkout sem persistir credenciais. Mantidos lint, tipos, Prisma validate, suites offline/produto/políticas, segurança de IA, integrações com PostgreSQL loopback descartável, concorrência, recuperação de senha, build, renderização real de mídia local e browser/E2E. Nenhum secret/recurso Neon/Vercel/Asaas/Meta/TikTok/IA/email é referenciado. Não há gatilho push, deploy ou migração externa; apenas pull_request e workflow_dispatch. As migrações do banco descartável das suites continuam necessárias e não atingem Neon. Artefatos limitados a evidências/listas específicas, excluindo cookies/storage-state/sessões. Não subir .env ou conteúdo do cluster local. Resultado atual: **workflow preparado, CI ainda não executado**.

**Como liberar CI sem alterar main:** é necessário que o commit a testar exista no GitHub. A autorização anterior condicionava push à validação final, que agora precisa ocorrer remotamente. Portanto solicitar autorização específica para **commit e push de preparação da branch `audit/finalizacao-inst-acessor`, explicitamente ainda não aprovada nos testes finais**, sem merge. Antes disso revisar diff/arquivos/segredos e comprovar que esse push/PR não disparará deploy no projeto de produção por integrações existentes. Não adicionar `[skip ci]` nem desativar verificações para contornar o problema. O workflow já existe no HEAD local, mas sua presença na branch padrão remota não foi comprovada. Segundo GitHub, workflow_dispatch precisa estar registrado na branch padrão; se disponível, selecionar a branch de finalização em Run workflow. Se indisponível, alternativa é autorizar um **PR em rascunho, sem merge**, depois de conferir os efeitos de deploy da integração Git. Não modificar main para registrar workflow sem autorização. Habilitar Actions/permissões e verificar minutos incluídos; não contratar runner pago nem ampliar orçamento automaticamente. Aprovação de código é somente após resultado do SHA enviado, correções necessárias e nova execução desse SHA final.

**Migração manual fora do GitHub:** usar outra máquina confiável com memória adequada (recomendado ao menos 8 GB), Node 24, clone da mesma branch/SHA e dependências do lockfile. Instalar dependências antes de disponibilizar credenciais, com URLs fictícias locais explícitas para o postinstall Prisma; nunca copiar node_modules de Windows para Linux. O proprietário transfere/configura SOMENTE as duas conexões de homologação em `.env.preview.local` ignorado, por canal privado, sem GitHub/artefatos/chat. Não enviar cookies, env original, chave de produção ou arquivos de clientes. O script não carrega esse arquivo automaticamente em build/CI.

Confirmar console Neon → projeto `winter-queen-11288843`, branch `br-summer-cake-b6dp3hnt`, banco `neondb` e compute `ep-muddy-resonance-b6dt5n2n`. Conferir SHA/diff e manifesto versionável `docs/neon-preview-migration-manifest.json`. O manifesto contém só IDs/checksums, não credenciais. `.gitattributes` fixa as quebras de linha de cada um dos onze arquivos para preservar seus bytes auditados ao clonar em outro sistema; **nenhum SQL histórico foi editado**. Se hash divergir, parar e revisar, não regenerar automaticamente para aceitar uma alteração.

Executar em terminal dessa máquina, na raiz do checkout de homologação:

```text
node bench/neon-preview-preflight.mjs
node bench/neon-preview-migrate.mjs --confirm-project=winter-queen-11288843 --confirm-branch=br-summer-cake-b6dp3hnt --confirm-database=neondb --confirm-migrations=11
```

O primeiro comando é somente leitura; o segundo exige todos os quatro argumentos exatos e repete preflight antes de qualquer escrita. Não colocar esses comandos em workflow, package postinstall/build, cron ou deploy. Confirmação ausente/incorreta bloqueia antes de ler conexões; confirmação correta não dispensa banco vazio, TLS, hosts fixos, manifesto e gate de memória. Stage temporário contém somente schema/migrações; processo Prisma recebe env mínima com as conexões dedicadas. Faz validate, migrate deploy e pós-validação em leitura das onze linhas/checksums, além de migrate diff --exit-code contra o schema, sem shadow/reset/seed/db push. Credenciais não aparecem em argumentos de processo ou logs. Falha/estado inesperado interrompe; não repetir automaticamente e não corrigir usando DROP/resolve. Histórico possivelmente parcial requer consulta somente leitura e plano específico. Após sucesso, guardar somente `outputs/verification/neon-migration-result.json` sanitizado; zero drift e onze concluídas são os critérios de aceite, não a existência de tabelas isoladamente.

Migração **continua autorizada somente no alvo acima**. Essa alternativa não autoriza enviar conexões para GitHub. Se no futuro preferir executar migração em GitHub Actions, obter autorização específica para armazenar/usar esses segredos em Environment exclusivo, com revisores obrigatórios e workflow_dispatch isolado; nenhum workflow de migração remota foi criado ou acionado agora.

**Verificações leves executadas nesta preparação:** sintaxe dos dois drivers passou; execução sem argumentos foi rejeitada antes de qualquer conexão (exit 1 esperado); onze checksums do manifesto coincidem com SQL existente; diff sem erros de whitespace. Não equivalem a pipeline, migração ou teste completo em outro sistema. YAML/runner Linux e pós-validação Prisma novos ainda aguardam execução no ambiente adequado.

**Intervenções mínimas do proprietário:** (1) liberar push de preparação antes da validação final, condicionado à revisão de segredos e dos efeitos Vercel; (2) permitir iniciar Actions dentro da quota disponível e, se necessário, PR em rascunho sem merge; (3) disponibilizar máquina confiável para a migração manual e configurar nela as conexões privadas; (4) confirmar acesso Sandbox/TikTok, remetente/caixa de teste e demais configurações externas já listadas. Nenhuma nova aprovação do mesmo alvo de migração é necessária; somente mudança de destino/escopo exigiria outra aprovação.

Fontes: [execução manual e requisito de branch padrão](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [recursos dos runners e quotas](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Recursos efetivos serão registrados no log do runner; não presumir disponibilidade ou aprovação de gastos.

**Após reinício solicitado pelo proprietário:** branch/HEAD preservados (`audit/finalizacao-inst-acessor`, `d7a2b1f`), 101 entradas de status existentes, arquivo de conexões continua ignorado. RAM consultada: 336 MB de 3.885 MB; processos Node observados sem classificação de build/teste, nenhum processo encerrado. Preflight de leitura repetido com sucesso em ambas as conexões: banco continua vazio/correto e onze hashes coincidentes; evidência sanitizada atualizada. Como a RAM já estava abaixo do gate de 400 MiB, o driver de migração não foi reiniciado. **Zero migrações aplicadas até esta conferência.** Não reduzir o gate nem repetir tentativas para contornar a falta de recursos.

#### Variáveis Vercel preparadas — sem valores

Alvo exclusivo `lp070087-5894s-projects` / `inst-acessor-preview`, ID `prj_dQV5VfpVcDf0SroSxqz9ec4ytgkW`. Preparação documental, não variáveis efetivamente gravadas no painel. Sem vínculo Git/deploy novo nesta etapa.

| Grupo | Nomes | Condição de configuração |
|---|---|---|
| Banco | `DATABASE_URL`, `DIRECT_URL` | Somente as conexões dedicadas já conferidas; não herdar variáveis compartilhadas nem copiar o env original |
| Origem e sessão | `AUTH_URL`, `SITE_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAIL` | Origem HTTPS estável exclusiva da homologação; segredos novos e persistentes, nunca reais de produção. ADMIN_EMAIL exige identidade de teste escolhida pelo proprietário |
| Efeitos desligados | `PUBLISHING_WORKER_ENABLED`, `PUBLISHING_SCHEDULER_ENABLED`, `TIKTOK_PUBLISHING_ENABLED`, `TIKTOK_AUDITED_PUBLISHING_ENABLED`, `TIKTOK_WEBHOOK_INBOX_ENABLED`, `SOCIAL_WEBHOOK_WORKER_ENABLED` | Manter false até configuração e autorização própria. Não configurar cron automático |
| Pagamentos | `ASAAS_ENV`, `ASAAS_BASE_URL`, `ASAAS_CHECKOUT_ORIGIN`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BILLING_TYPE` | Somente Sandbox; chaves exclusivas ainda pendentes. Conferir base efetiva, não apenas etiqueta; PIX/cartão preservados |
| Sociais/IA/mídia/email | Nomes no inventário abaixo | Deixar sem credenciais enquanto não houver conta/escopo/destino autorizado. Não simular integração disponível |

Configurar o escopo **Preview** e publicar como deployment Preview (sem `--prod`). O nome `inst-acessor-preview` por si só não define `VERCEL_ENV`; o código atual usa esse indicador em noindex e proteção Asaas. Confirmar `VERCEL_ENV=preview` fornecido pelo provedor antes do smoke, sem sobrescrevê-lo manualmente. Manter Deployment Protection; webhooks externos bloqueados por ela exigem solução específica de acesso aprovada, nunca desativação global ou token no Git. Nenhum callback atual da Meta que aponta para produção deve ser alterado automaticamente para essa origem. Não executar migrações como parte do build.

**Após preenchimento das conexões:** o arquivo exclusivo foi analisado em memória, sem imprimir valores. Ambas as URLs inicialmente usavam o hostname direto do compute autorizado; corrigido somente o hostname de DATABASE_URL para o pool correspondente, preservando credenciais/banco/TLS. Destinos, identidade pool/direct, TLS e onze hashes conferidos. `node bench/neon-preview-preflight.mjs` passou fora do bloqueio de rede local: ambas as conexões abriram com certificado TLS verificado; database/role coincidentes, USAGE/CREATE public, zero relações de usuário e nenhum histórico Prisma. Evidência sanitizada em `outputs/verification/neon-connections-preflight.json`.

Preparado `bench/neon-preview-migrate.mjs`: repete preflight estrito, exige memória mínima, copia somente schema/migrações para pasta temporária isolada, executa o Prisma instalado com env sanitizada e confere onze históricos/checksums em leitura. Sem reset/seed/resolve/db push/fallback. A tentativa autorizada passou no preflight, mas **foi interrompida por memória insuficiente antes de iniciar o Prisma**. Consulta inicial havia mostrado 595 MB e nenhum processo Node classificado como build/teste; no gate imediatamente anterior ao CLI havia menos de 400 MiB. Nenhuma migração executada, nenhum retry automático. Não confundir a existência do driver com aprovação de sua execução completa; pós-validação ainda não ocorreu. Revalidar alvo/estado e RAM antes de retomar.

**Instrução posterior do proprietário:** `@inst_acessor` deve ser preservado; não é conta descartável de teste. A função de Testador no painel não autoriza publicar, enviar mensagens, excluir dados, alterar o perfil ou realizar OAuth. Continuar somente consultas/preparação até autorização específica. Asaas Sandbox e portal TikTok estão sendo preparados pelo proprietário; aguardar confirmação de acesso antes de consultar esses painéis.

Criado `.env.preview.local` com `DATABASE_URL`/`DIRECT_URL` vazias e comentários do alvo exclusivo. Confirmado ignorado pela regra `.env*` e não rastreado no Git. Modal Connect do projeto/branch corretos aberto com banco `neondb`, role `neondb_owner`, senha oculta; usuário preencherá pool ligado em DATABASE_URL e pool desligado em DIRECT_URL. Nenhum valor copiado/lido nem migração executada. Após preenchimento, validar ambas as URLs em memória sem exibir segredos e conferir estado real antes da escrita autorizada. Este arquivo não é carregado automaticamente nem autoriza fallback de env.

O proprietário autorizou especificamente as onze migrações **somente** em `winter-queen-11288843` / `br-summer-cake-b6dp3hnt` / `neondb`, condicionadas a conexões dedicadas conferidas e schema sem alteração/conteúdo inesperado; sem seed/reset/db push/produção. Não foram executadas: falta configurar as conexões dedicadas para Prisma, sem herdar `.env` original. `.env.preview.local` é ignorado pelo Git (conferido); solicitado ao proprietário configurar somente esse arquivo, sem valores no chat. A aprovação supera as menções históricas de autorização pendente neste documento; não autoriza outros alvos nem operações.

IA: preparar sem chamadas pagas. Email: sem envios externos. Asaas: somente consulta do ambiente aberto, sem alterações financeiras/cobranças. Meta/TikTok: somente configuração/permissões/URLs; contas de teste e operações devem ser confirmadas antes de OAuth, publicação ou mensagens; não enviar App Review nem alterar configuração pública.

**Meta, consulta real somente leitura:** app `Inst Acessor` ID `1430873779142794`, status **Não publicado**; produto Instagram `Inst Acessor-IG`, ID específico **`1663459425210369`**. Para o fluxo Instagram Login, conferir `INSTAGRAM_APP_ID` e seu par de segredo contra o produto correto; não presumir que o ID geral e o ID Instagram são intercambiáveis. Nenhum segredo revelado. As cinco permissões `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments` e `instagram_business_manage_messages` aparecem **Pronto para teste**; não é prova de acesso avançado/App Review concedido nem consentimento de um perfil específico. Perfil `@inst_acessor` listado como Testador do Instagram; confirmação de uso exclusivamente de teste solicitada, sem conexão ou ação no perfil.

No painel existente, webhook `https://unitrixapp.com.br/api/webhooks/instagram` e redirect OAuth `https://unitrixapp.com.br/api/integrations/instagram/callback`; **ambos pertencem à origem atual de produção e foram somente lidos**. Não redirecionar para Preview nem usar o botão Teste nessa configuração. Assinaturas mostradas v26.0, incluindo comments/messages; isso não aprova os handlers nem permite trocar a versão do código sem regressão. O painel alerta que o app precisa estar publicado para receber webhooks e pede análise para dados ao vivo. Conferir desautorização/exclusão e exigência de Provedor de Tecnologia/verificação de acesso antes da submissão. Nenhuma configuração foi salva.

**Asaas:** aba aberta `https://www.asaas.com/dashboard/home`, ambiente de produção, não Sandbox. Nenhum teste, consulta financeira adicional ou alteração realizada. Solicitar acesso separado ao Sandbox; não utilizar a sessão/credenciais dessa conta para homologação. No código o único provedor de email implementado é **Resend**; isso não comprova chave, domínio ou remetente configurados. Ainda necessários: remetente verificado, caixa fictícia autorizada e configuração exclusiva, sem envio até autorização específica. TikTok ainda sem app identificado em painel autenticado; solicitado abrir o portal do aplicativo, sem perfis reais.

Revisão de recuperação: o revisor delegado foi interrompido por limite de uso, sem parecer final. Coordenador conferiu estaticamente hash/TTL, transação/lock/CAS, revogação JWT existente, limites, origem e contrato UI/rotas; não encontrou bloqueador concreto nessa leitura. Isso não substitui execução ou revisão independente completa. Teste preparado `node bench/integration-publishing.mjs password-reset`, cluster loopback novo e transporte de email mockado; CI registra esse modo sequencial. Não executado por falta de memória. O driver não roda a suíte de publishing nesse modo.

Este inventário supera estados históricos abaixo. Código e evidências locais foram reaproveitados; nenhum mock é certificado de integração real. Worktree `.audit-worktree`, branch `audit/finalizacao-inst-acessor`, HEAD base `d7a2b1f`, alterações preservadas sem commit. Push após validação e Preview isolado estão autorizados; produção e efeitos externos continuam sujeitos aos gates específicos. Última RAM: 43 MB livres em 3.885 MB; não executar build/DB/browser de teste nesse estado.

### Disponibilidade de credenciais

Na última leitura do painel Vercel, `inst-acessor-preview` não tinha variáveis próprias nem compartilhadas vinculadas. Portanto não há credenciais de produto comprovadas no ambiente de homologação. A existência de um nome em código ou `.env.example` não comprova uma chave. Valores de `.env*`, credenciais de produção e registros cifrados do administrador não foram lidos. O schema Neon de teste ainda não tem tabelas de aplicação. A resolução de IA aceita configuração cifrada no banco do Admin com fallback para env, mas esse caminho não foi provisionado no Preview. Não reutilizar segredos, cookies ou dados reais.

### Implementação, evidência e bloqueios por serviço

| Serviço | Implementado / evidência local | Pendências e testes reais |
|---|---|---|
| Meta/Instagram | OAuth Instagram Login, state único, conexão, sync/insights, refresh quando aplicável, desconexão, adapters dos quatro formatos, comentários/Direct e assinatura de webhooks. Evidências históricas e 16 checks de status; não são contas reais | App de teste, conta profissional, scopes efetivamente concedidos, versão Graph suportada, elegibilidade Story, callbacks/webhooks, janela de mensagens e App Review. Página oficial retornou 429 nesta conferência; não certificar requisitos atuais ou aprovação. Facebook Login/Page Publishing independente não foi comprovado nem implementado por esta leitura |
| TikTok | OAuth básico e publicação opt-in; capacidades do criador, escolha explícita de privacidade/interações, consentimentos, disclosures, vínculo ao conteúdo/snapshot, revalidação no adapter, status e inbox durável. 34 checks de política e 28 de inbox de rodadas anteriores | Chave/app de teste, `video.publish` concedido, auditoria e origem de mídia verificada. Não auditado: conta privada e `SELF_ONLY`. Handlers de eventos de publicação seguem em quarentena; não declarar webhook completo. Interface, OAuth, renovação/revogação e envio real não aprovados |
| Gemini | Provider REST de texto, modelo permitido/configurável, timeout, contexto limitado e medição por recurso; 27 checks de orçamento compartilhado históricos | Chave e acesso ao modelo no projeto correto, quota e orçamento do provedor. Correção nova: chave no header, sem query; erros HTTP/rede/JSON genéricos; falta teste do lote novo. Não implementa geração de imagem/vídeo nem chamadas de ferramentas |
| OpenAI | Chat Completions para texto, configuração cifrada/env, allow-list `gpt-4o-mini`/`gpt-4o`, timeout/contexto; 27 checks de orçamento compartilhado históricos | Projeto/chave exclusiva e teste autorizado. Correção nova de erros e transporte, ainda sem validação final. Não há prova de consumo monetário real nem suporte a todo modelo/modalidade; não trocar modelo/API silenciosamente |
| Asaas | Único gateway, PIX/cartão, checkout hospedado, aliases de URL e fallback ID com origem explícita, billing/webhook idempotente e acesso; 29 checks de contrato e suítes offline/DB anteriores | Sandbox identificado, origem/API efetivas, header real/reentrega, pagamento simulado, recorrência, cancelamento, estorno/chargeback quando simuláveis e acesso ponta a ponta. Retorno do checkout não confirma pagamento |
| Neon | Projeto separado e branch IDs confirmados; consulta de metadados em leitura no alvo de teste aprovada, ver resultado abaixo. Onze migrações já testadas em PostgreSQL local descartável | Conexões pool/direct e TLS ainda não configuradas/confrontadas. Role do console é owner, não uma role runtime com menor privilégio. Migração externa exige autorização; depois smoke/schema/permissões no alvo |
| Vercel | Projeto separado criado, autenticação Standard Protection, nenhuma variável/Git/deploy, treinamento de dados desativado; oito checks locais de noindex | Configurar env exclusiva, pacote/commit validado, framework/build e conexão do banco. Nenhuma URL do aplicativo validada. Confirmar política de auto-deploy antes de push/integração Git; não tocar projeto original |
| Vercel Blob | Upload SDK, autorização de proprietário, biblioteca, originais/derivados e limites; testes locais de pixels e protocolos substituídos | Store/token exclusivo, CORS/HEAD, upload real, referências e órfãos. URLs públicas não são armazenamento privado. Não provisionar serviço/custo sem escopo próprio |
| Email | Dispatcher Resend REST, primeiro acesso, acesso liberado e novo template de recuperação; sem configuração falha sem simular envio | Domínio/remetente verificado, chave e caixa fictícia; teste de entrega/reentrega autorizado. Entrega após pagamento é best-effort, sem outbox garantida. Recuperação nova implementada localmente, ainda sem teste executado; não confundir primeiro acesso com recuperação |
| Auth/admin/segurança | Guards no servidor, suspensão/revogação, propriedade, premium/admin e rate limit persistido existentes; novo backend/UI de recuperação com token hash, uso único transacional e expiração | Regredir lote final e testar recuperação em banco descartável/navegador, primeiro acesso por email e fluxo real de exclusão. Testes anteriores não aprovam automaticamente cada novo endpoint |
| Scheduler/monitoramento | Endpoint autenticado, processo dedicado desligado, claim/snapshot/quarentena/reconciliação admin; publicação/reconciliação/XP com 24/17/29 checks anteriores | Hospedagem, frequência/capacidade, backlog, alertas e notificações duráveis; teste de interrupção na hospedagem e reconciliação com resultado remoto. Sem cron automático de Preview presumido |

### Variáveis e rotas — somente nomes e caminhos

`ORIGIN_PREVIEW` abaixo é marcador documental para uma origem HTTPS estável futura, não variável obrigatória do aplicativo nem URL já publicada.

| Serviço | Variáveis usadas / preparação | Callback, webhook ou endpoint |
|---|---|---|
| Core/Neon/Vercel | `DATABASE_URL`, `DIRECT_URL`, `AUTH_URL`, `SITE_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAIL`; `NEXTAUTH_URL` derivado de `AUTH_URL`; `VERCEL_ENV` do provedor | Rotas privadas exigem sessão; o noindex não substitui Deployment Protection |
| Meta | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_SCOPES`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`; aliases legados `META_APP_ID`, `META_APP_SECRET` | `ORIGIN_PREVIEW/api/integrations/instagram/callback`; `/api/webhooks/instagram` para comentários/Direct. `/api/webhooks/publishing` é receptor genérico, não o motor; não cadastrar eventos duplicados sem mapear os handlers |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_SECRET`, `TIKTOK_WEBHOOK_VERIFY_TOKEN`, `TIKTOK_PUBLISHING_ENABLED`, `TIKTOK_AUDITED_PUBLISHING_ENABLED`, `TIKTOK_VERIFIED_MEDIA_ORIGINS`, `TIKTOK_WEBHOOK_INBOX_ENABLED`, `SOCIAL_WEBHOOK_WORKER_ENABLED` | `ORIGIN_PREVIEW/api/integrations/tiktok/callback`; `/api/webhooks/tiktok`; `/api/integrations/tiktok/creator-info` |
| IA | `OPENAI_API_KEY`, `GEMINI_API_KEY` ou `GOOGLE_API_KEY`; preferência/modelos no Admin, não inventar envs de modelo não lidas | Endpoints externos fixos OpenAI `/v1/chat/completions` e Gemini `generateContent`; sem OAuth/callback do usuário |
| Asaas | `ASAAS_ENV`, `ASAAS_BASE_URL`, `ASAAS_CHECKOUT_ORIGIN`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BILLING_TYPE` | `ORIGIN_PREVIEW/api/webhooks/asaas`; retorno `/checkout/retorno` com status/referência gerados pelo servidor; não é confirmação financeira |
| Blob/email | `BLOB_READ_WRITE_TOKEN`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` | `/api/upload/media`, `/api/media-library`; primeiro acesso `/primeiro-acesso`; nenhum webhook de entrega Resend comprovado |
| Worker | `CRON_SECRET`, `PUBLISHING_WORKER_ENABLED`, `PUBLISHING_SCHEDULER_ENABLED`, `PUBLISHING_SCHEDULER_ORIGIN`, `PUBLISHING_SCHEDULER_INTERVAL_MS`, `SOCIAL_WEBHOOK_WORKER_ENABLED` | `/api/cron/publishing`, `/api/cron/social-webhooks`; processo externo desativado até aprovação e destino comprovado |

### Meta: pacote de App Review a preparar, não enviar

O código pede `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments`, `instagram_business_manage_messages`. Lista solicitada não é lista concedida/aprovada. Preparar matriz permissão→tela/ação/dado→finalidade, conta profissional e usuários de teste, gravações dos fluxos, exemplos sanitizados e justificativa mínima por recurso; conferir política, URLs públicas definitivas, controlador/contato e exclusão operacional antes da submissão. Os documentos legais atuais são de homologação e não bastam como procedimento real. Não submeter revisão ou alterar configuração pública sem autorização. A documentação oficial da Meta não pôde ser recuperada (429); requisitos atuais continuam pendentes de confirmação direta no portal/documentação, sem inferência a partir de nomes de scopes.

### Consumo e limites de IA

Franquias estão explicitamente em **medição** (`LIMITS_ENFORCEMENT_ENABLED=false`). O contador de gerações/recursos não equivale a tokens faturados ou gasto monetário real. O contrato atual retorna texto, não um ledger de custo por provedor. Tetos de contexto/saída e timeout reduzem exposição, mas não são orçamento financeiro rígido. Definir limites de projeto no provedor e decisão comercial antes de ativar bloqueios; não foi alterada a política. Não adicionar fallback pago automático em falha. Revisão humana continua obrigatória antes de publicar conteúdo gerado.

### Leitura Neon efetivamente executada e proposta de migração

Conferência posterior da janela Connect, mantendo a senha oculta: hosts direto e pool do mesmo compute, banco/role `neondb`/`neondb_owner`, TLS `sslmode=require` e `channel_binding=require`. Não foi acionado Show password, copiada conexão nem configurado Prisma/Vercel. Os resultados não secretos foram salvos em `outputs/verification/neon-preflight-readonly.json`. Isso não substitui validar o destino efetivo das variáveis quando forem configuradas. O manifesto foi preparado e a autorização específica da migração foi solicitada, ainda não recebida.

Alvo: projeto `winter-queen-11288843`, branch `br-summer-cake-b6dp3hnt` (nome `production`, pertencente somente à homologação), banco `neondb`, compute `ep-muddy-resonance-b6dt5n2n`. O console mostrou `0 tables in public schema`. Foi executado apenas um SELECT de metadados, após substituir o exemplo CREATE/INSERT do editor. Resultado: database `neondb`, role `neondb_owner`, PostgreSQL `18.6 (fd34222)`, CONNECT/USAGE public/CREATE public verdadeiros, zero tabelas de usuário visíveis em information_schema e `public._prisma_migrations` ausente. Não houve INSERT/UPDATE/DDL/migração nem acesso ao banco de produção. Isso comprova leitura no console e privilégios dessa role, não configuração das conexões Prisma pool/direct nem ausência de todos os tipos de objeto não tabular.

Preparado `outputs/verification/neon-migration-manifest.json`: lista ordenada das onze migrações com SHA-256, IDs do alvo e execução/autorização marcadas como não realizadas. Antes da escrita: verificar conexões exclusivas/TLS e o destino efetivo, comparar o manifesto ao código final, confirmar que o estado não mudou e revisar SQL. Operação proposta: Prisma local `migrate deploy` em diretório isolado contendo apenas schema/migrações, sem env original, somente no alvo acima; sem seed, reset, `db push`, `migrate dev` ou `resolve` da baseline. Falha interrompe a sequência e preserva evidências; não reexecutar às cegas nem tentar desfazer com DROP. **Não autorizada nem executada.** Nova aprovação específica é necessária.

### Correções novas e verificações nesta rodada

Última leitura de RAM: **97 MB livres de 3.885 MB**. Build, banco e navegador não foram iniciados nesse estado. A condição de validação para commit/push e deploy continua pendente.

Asaas: preflight agora exige `ASAAS_CHECKOUT_ORIGIN` válida antes de consultar plano, reservar capacidade, gravar ordem ou chamar o gateway. A URL efetiva da API governa a decisão, não a etiqueta `ASAAS_ENV`; em `VERCEL_ENV=preview`, somente Sandbox é aceito. **Mudança de configuração obrigatória:** origem explícita é exigida também quando a resposta remota contém `link`/`url`, para falhar antes da criação remota. Revisão independente estática sem P0/P1 concreto; 54 verificações previstas de contrato/preflight preparadas, **não executadas**. Repetir os testes Asaas afetados, incluindo a suíte histórica de 81 checks. Falta comprovar a orquestração sem DB/HTTP na rejeição e o contrato no Sandbox. `CHECKOUT_PAID` não libera acesso: comprovar o vínculo dos eventos PAYMENT com a compra e o plano; não conceder acesso por retorno de navegador.

Recuperação de senha: página `/recuperar-senha`, endpoints `/api/password-reset/request` e `/api/password-reset/complete`, template exclusivo sem fallback de remetente e teste de banco preparados. Token aleatório de 256 bits, apenas hash no banco, TTL de 15 minutos, vínculo à versão da senha, consumo/CAS/invalidação de links na mesma transação; limitação persistida e respostas genéricas. Email leva `#token=...`, lido no cliente e removido da URL. Sem novo bypass, schema ou migração. **Implementado sem validação executada**; revisão independente em andamento. Resposta do pedido aguarda email: diferenças de tempo ainda podem revelar existência de conta; não prometer resistência a enumeração por timing. Entrega durável de email ainda exige arquitetura de outbox e política de retenção/limpeza dos tokens.

Providers Gemini/OpenAI agora recusam chave vazia antes do transporte, rejeitam redirects, usam no-store e não propagam corpo de erro, exceção de rede ou erro de parsing do provedor. Gemini envia a chave no header `x-goog-api-key`, nunca na URL. Mantidos os modelos, interface de texto, timeout e limites existentes. Preparado `bench/test-ai-provider-security.mjs`, modo sanitizado `ai-security`, incluído no CI; **não executado** por memória insuficiente. `test-ai-budget` precisa ser repetido por essa alteração, apesar da aprovação histórica. Não houve chamada paga. Build/tipos/lint/E2E do lote final ainda pendentes.

Fontes oficiais conferidas: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Gemini autenticação](https://ai.google.dev/api), [Asaas checkout](https://docs.asaas.com/reference/create-new-checkout), [Asaas retorno](https://docs.asaas.com/docs/checkout-link-and-customer-redirection), [Asaas webhook](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint). Consulta documental não é teste de integração e não concede aprovação de conta, modelo ou permissão.

### Checklist de liberação comercial

1. Recuperar memória ou bancada apropriada; concluir testes afetados de IA/TikTok/editor/legal e build/tipos/lint final, em sequência.
2. Validar e corrigir o novo fluxo de recuperação de senha; completar procedimento de exclusão, definir controlador/contato e revisar documentos jurídicos.
3. Confirmar env/destinos/role de runtime do Preview; obter autorização da migração exata e aplicar/verificar schema isolado.
4. Revisar diff/segredos, organizar commits, push autorizado e CI explícito. Não fazer merge com testes essenciais pendentes.
5. Publicar só lote validado no projeto Preview isolado; smoke com dados fictícios, limites/proteção/logs, sem credenciais de produção.
6. Autorizar individualmente contas/efeitos/custos para Asaas Sandbox, Meta/TikTok, IA, Blob e email; testar entrega/reentrega, falhas e recuperação reais.
7. Fechar App Review/scopes, scheduler/alertas, retenção/backups/rollback e dispositivos físicos. Apresentar checklist final de produção para aprovação; não liberar clientes antes disso.

**Estado:** sem novo commit/push, sem deploy do aplicativo, sem cobrança, mensagem ou publicação social. Preview criado, aplicação ainda não homologada. O SaaS **não está pronto para clientes pagantes**.

## Registro histórico do plano anterior

As seções abaixo preservam o plano anterior; estados atuais, leituras realizadas e autorizações são os do inventário acima. A existência de uma operação planejada não autoriza sua execução.

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
