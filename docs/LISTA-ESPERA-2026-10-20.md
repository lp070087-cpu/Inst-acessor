# Lista de espera e pré-lançamento — 20/10/2026

## Entrega local, sem abertura pública

Branch `audit/finalizacao-inst-acessor`, worktree `.audit-worktree`. Trabalho anterior preservado. O proprietário autorizou commit/push de preparação após revisão de segredos e proteção contra deploy automático, Actions dentro da quota e PR em rascunho sem merge. Nenhum envio externo, produção, domínio oficial ou migração adicional autorizado.

## Implementado, aguardando validação de runtime

- Landing: seção `#lista-de-espera` no estilo existente, formulário acessível, nomes/email/WhatsApp E164, plano preenchido pelo CTA, canais separados desmarcados, política de privacidade e mensagens de erro/sucesso sem dados de terceiros. Não exige sessão/pagamento. Limites cliente/servidor alinhados em nome100/email254. Validações de transporte, não prova de posse de telefone.
- Planos: o catálogo tem três ativos semanal/mensal/anual e cinco versões futuras inativas. A landing anterior exibia semanal e cinco vitrines futuras, omitindo mensal/anual. Por instrução atual de manter três planos, agora mostra os três ativos com seus nomes, preços e benefícios derivados do mesmo catálogo; catálogo e planos futuros não foram removidos/alterados. CTAs de assinatura existentes preservados, CTAs de interesse adicionados. Nenhuma data criada. Barra preta e countdown existentes não editados; countdown já depende de configuração administrativa, padrão desativado/sem data.
- Persistência: domínio novo separado do WaitlistEntry legado, com quatro modelos; unicidade de email/telefone, cadastro concorrente protegido, auditoria de consentimento/data/origem/versão, token256bits com hash/TTL24h, payload privado cifrado. Duplicatas não sobrescrevem dados/consentimentos; reemissão somente PENDING expirado e identidade email+telefone coincidente.
- Confirmação e descadastro: páginas públicas com token no fragmento lido somente no cliente, URL limpa, botão humano e POST; GET não muda estado. Confirmação de email não é comprovação da posse do WhatsApp. Descadastro revoga canais, cancela fila elegível e retém resultados já incertos para revisão.
- Administração `/admin/pre-lancamento`: guard servidor, totais, 30 dias UTC, interesse/origem/status, opt-ins, fila por canal/estado, pesquisa/filtros/paginação, CSV máximo1000 com proteção contra fórmula e no-store. Legado de capacidade mantido. Não expõe PII/tokens em endpoints públicos.
- Campanhas: confirmação prepara WELCOME por canal consentido uma vez; campanha LAUNCH exige confirmação administrativa e chave estável. Fila HELD por padrão, sem consumidor/transporte/cron. Claims atômicos, lease e marcação UNCERTAIN sem retry automático. SENT significa aceitação, não entrega comprovada. Preparar campanha não abre vendas nem autoriza envio.
- Templates puros responsivos VERIFY/WELCOME/LAUNCH com nome/plano, cancelamento, escape de HTML, links validados e gate explícito de aprovação antes do texto de pré-venda aberta. Contratos Resend/WhatsApp oficial preparados; **transporte da nova fila ainda não implementado/validado**. A integração Resend existente de primeiro acesso não comprova estes envios. Nenhuma automação WhatsApp Web.

## Banco e fronteira de autorização

Nova migração proposta `20261020190000_launch_waitlist`, manifestada separadamente em `docs/launch-waitlist-migration-manifest.json`; não aplicada. As onze anteriores continuam no manifesto autorizado, com snapshot do schema de onze isolado. O driver remoto copia somente esses onze nomes e esse snapshot; não engloba a décima segunda por glob ou schema novo. Históricos não editados. Migração nova precisa de aprovação adicional explícita antes de execução no Neon de homologação. Nenhuma migração de produção.

## Validação e visualização iPhone

RAM medida187MB livres em3885MB. Não iniciado Next/build/DB/browser de testes localmente. **A landing nova ainda não foi aberta/renderizada em iPhone emulado nesta entrega**; não há captura visual aprovada. Não apresentar HTML estático ou mockup como aplicação real.

Preparado `bench/test-launch-landing-ui.mjs`: após build, abre a landing Next real, Chromium único e três contextos sequenciais375×667/390×844/430×932; verifica CTAs/preenchimento/foco/consentimentos/tipo e tamanho de campo/overflow/respostas200e503 e screenshots. Somente o POST público é substituído por fixture para contrato visual, sem comprovar persistência ou entrega. Banco/concorrência usam suite separada descartável. Teclado virtual/Safari e iPhone físico não aprovados por emulação.

CI prioriza schema/tipos/lint/build e essas capturas antes das regressões amplas. `bench/integration-launch-waitlist.mjs --migration=20261020190000_launch_waitlist` aplica11+12 somente em cluster local do runner e testa identidade, consentimento, confirmação/descadastro, concorrência, WELCOME, reemissão, campanha idempotente, claims e rollback. Nenhum teste pesado novo foi executado no computador.

Verificações leves: `safe-run launch-waitlist` passou (validação/template, sem DB); `safe-run preview-config` passou incluindo bloqueio automático da branch. Sintaxe dos drivers passou; diff check passou. Contagens exatas nos logs; não equivalem a E2E ou integração real. Tipos/lint/build e suites de banco/mobile do lote atual aguardam CI. Revisores estáticos não encontraram P1 na preparação HELD, apontaram limites cliente/servidor, reemissão e UTC; corrigidos, regressão runtime pendente.

## Git/Preview e abertura real

Vercel produção foi consultada somente em leitura: repositório conectado, sem hooks listados. `vercel.json` preparado com git.deploymentEnabled=false somente para `audit/finalizacao-inst-acessor`, conforme contrato oficial; demais branches não alteradas. Proteção validada por teste puro, não prova de um push/deploy já realizado. Não alterar configurações atuais. GitHub main não contém o workflow consultado, então poderá ser necessário PR em rascunho para disparar pull_request. API Actions permissions retornou403; não presumir permissão de execução apesar da autorização do proprietário. Nunca enviar env/segredos como solução.

Para abrir inscrições reais: obter CI verde e revisão visual, aplicar esquema de homologação revisado/autorizado, configurar Preview protegido com origem/segredos próprios, validar cadastro/descadastro/admin por HTTP real, ativar transporte Resend somente com autorização de envio e remetente/caixa fictícia, comprovar domínio/configurações, idempotência e webhooks de entrega. WhatsApp exige conta/phone number id/template aprovado/consentimento e prova persistida de posse, além de custo/limites autorizados. Implementar/revisar consumidor e callbacks de entrega antes de prometer notificações; não tornar HELD automaticamente READY por flag. Definir controlador/contato/retensão e revisar política jurídica. Aprovação final separada antes do domínio oficial, mensagens a interessados e abertura comercial.
