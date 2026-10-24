# Inst Acessor — implementação e validação de 18/10/2026

## Escopo e preservação

Esta rodada executa o comando de finalização completa em atividades locais. Não constitui aprovação operacional do SaaS. Integrações reais, dispositivos físicos e publicação permanecem dependentes das autorizações específicas do proprietário.

Base confirmada: worktree `.audit-worktree`, branch `audit/finalizacao-inst-acessor`, HEAD inicial `d7a2b1f4ec656bcbb0231d15079c48bb950e8e65`. Alterações já existentes e preservadas: `.gitignore`, `next.config.mjs`, `package.json`; arquivos de demonstração em `src/app/demo`, `src/components/demo`, `src/lib/demo-policy.ts`, `bench/demo-*`, `bench/test-demo*`; `AGENTS.md`, `.agents/skills`, `docs/equipe`, `docs/NEON-PREVIEW-INICIAL.md`, `docs/PREVIA-MOBILE-LOCAL.md` e `docs/PREPARACAO-PREVIEW-2026-10-18.md`. Esses itens não são apresentados como implementações desta rodada.

Não foram lidos valores de `.env*`, reutilizadas credenciais reais, instaladas dependências, acessados serviços de produto, realizadas cobranças, mensagens, publicações, OAuth, push, merge ou deploy. Bancos de teste são clusters PostgreSQL novos, descartáveis e limitados a loopback, com fixtures sintéticas.

## Decisões reconciliadas

- **Confirmado anteriormente:** identidade em `ESCOPO-OFICIAL.md`, histórico Git e apresentação: branco gelo, magenta/roxo, gradientes, tipografia, sombras e componentes existentes. Nenhum redesenho ou preço alterado nesta rodada.
- **Confirmado anteriormente e reiterado:** Asaas único gateway; PIX/cartão; administrador oficial ilimitado conforme regra existente; Rank/Growth gratuitos; franquias em medição, sem bloqueio comercial novo; conhecimento proprietário somente com material fornecido pelo dono.
- **Novos requisitos explícitos deste comando:** editor de imagem com exportação real; persistência de sete slides; edição/timeline de vídeo; três layouts de tela dividida; exportação local e projetos editáveis; fechamento operacional da fila e reconciliação.
- **Conflito comercial a resolver antes de publicar:** referência a “quatro versões” na landing versus catálogo e propostas históricas com planos legados e novos planos ainda inativos. Não ativar ofertas nem deduzir preços pela menção histórica a semanal/mensal/anual. Conferir catálogo e decisão comercial aprovada mais recente antes do Preview comercial.
- **Landing:** versão atual e histórico registram encurtamentos deliberados e ordem da pasta de referência. Não foi substituída por template nem restaurada uma versão antiga por suposição; a nova estrutura de referência deve ser conciliada com oferta/textos finais sem inventá-los.
- **Intelligence:** não foram iniciados Gestor, Radar, prospecção nem metodologia de crescimento. Correções nos módulos IA existentes não autorizam esse roadmap adicional.

## Equipe e responsabilidade

Foram usados quatro agentes no máximo: coordenador e três delegados, reutilizados em rodadas. Os doze papéis são especialidades do catálogo, não doze agentes simultâneos.

| Papéis | Trabalho | Arquivos principais e aceite |
|---|---|---|
| 01 Coordenador | Contratos, integração, vídeo, scheduler e evidências | `video-project.ts`, `video-renderer.ts`, `video-editor.tsx`, `scripts/publishing-scheduler.mjs`; exportação real sem servidor pesado |
| 02 Frontend / 10 Qualidade | Imagem, carrossel, persistência, responsividade | `preview-social-client.tsx`, `preview-frame.tsx`, `image-export.ts`; reabrir sem perder ordem/edições |
| 03 Backend / 04 Segurança | Publicação, reconciliação e autorização | `service.ts`, `reconciliation.ts`, rotas e painel; sem reenvio incerto, efeitos locais transacionais |
| 05 Banco / 11 Infra | Inbox, snapshots, migrações e isolamento | Schema, migrações aditivas, drivers descartáveis; nenhuma alteração externa |
| 06 Redes / 08 Asaas | Story, status, contratos checkout e TikTok | Compatibilidade, adapters, hosted checkout e inbox; não confundir container pronto com publicação |
| 07 IA | Orçamento de contexto dos providers | `limits.ts`, OpenAI/Gemini; sistema e histórico dentro do teto combinado |
| 09 Testes | Testes puros, PostgreSQL e navegador | `bench/test-*`, drivers; assertions reais, mocks identificados |
| 12 Revisor independente | Revisões cruzadas, sem autoaprovar autoria | Encontrou reabertura incompleta, status Instagram incorreto, invalidação/cancelamento de vídeo e IDs TikTok; correções retornaram aos autores |

## Matriz funcional reconciliada

“Implementado e testado” refere-se estritamente ao aceite local e às evidências identificadas; não significa aprovação de integração real. Relatórios de 17/10 são históricos identificados, não novas execuções.

| Requisito / origem | Esperado e estado real | Integração / pendência | Prioridade e aceite |
|---|---|---|---|
| Cadastro/login/primeiro acesso — confirmado | Implementados; evidências locais anteriores de identidade e concorrência preservadas | Email real e identidade histórica ainda exigem Preview autorizado | P0: sessão não admite suspenso/JWT revogado |
| Recuperação/verificação email — confirmado | Fluxos existentes; entrega externa não aprovada | Caixa/provedor de teste e callbacks reais | P1: token único, prazo e entrega reais |
| Premium/grants/admin — confirmado | Guards no servidor; regras e acesso admin preservados | Verificar configuração de administrador em Preview | P0: isolamento e autorização server-side |
| Planos/promo/capacidade — confirmado | Regras e testes locais anteriores; nenhuma política comercial nova | Decisão de ofertas/quatro versões | P1: catálogo e preços aprovados coerentes |
| Asaas checkout `link` — confirmado | Corrigida escolha da primeira URL válida entre aliases | Sandbox real pendente | P0: alias vazio/inválido não oculta próximo válido |
| Asaas checkout só `id` — contrato atual | Construção exige origem explícita validada pelo destino efetivo | Confirmar origem hospedada Sandbox | P0: nunca inferir produção para teste |
| PIX/cartão/recorrência — confirmado | Preservados; nenhum boleto adicionado; recorrência por cartão conforme implementação | Sandbox: pagamento, renovação, cancelamento, estorno e chargeback suportado | P0: concessão/revogação única |
| Webhook financeiro — confirmado | Integridade e concorrência locais anteriores preservadas | Header/formato/reentrega reais pendentes | P0: não marcar sucesso antes dos efeitos |
| Biblioteca/upload — confirmado | Proteções existentes preservadas; originais e derivados separados | Blob real, órfãos e corrida de referências ainda exigem prova | P0: URLs por proprietário, MIME real e limites |
| Imagem — novo | Canvas exporta JPEG, crop/posição/zoom/rotação/brilho/contraste e proporções | CORS/Blob real pendente; não é antivírus | P1: pixels/dimensões mudam e original permanece |
| Carrossel — confirmado + evolução | Sete slides, múltiplos arquivos, remover/substituir/reordenar e edição individual | Publicação real e retorno da Meta pendentes | P1: salvar/reabrir mantém todos e ordem enviada |
| Rascunho — confirmado | Projeto versionado no campo existente; PATCH do mesmo ID e leitura legada | Revisão de arquivos históricos no Preview | P1: não duplicar nem perder edições |
| Vídeo — novo | Projeto com trims, divisão/junção/ordem, enquadramento, proporção, volume, textos e fade | Render local limitado; não equivale ao CapCut completo | P1: arquivo exportado reproduz projeto |
| Tela dividida — novo | Lado a lado, empilhado e janela; crop/zoom/offset/volume por trecho | Mesmo arquivo simultâneo em tempos distintos requer decodificadores separados; atualmente recusado explicitamente | P1: pixels da composição correspondem ao arquivo |
| Projeto de vídeo — novo | JSON editável, originais separados, reabrir rascunho/importar projeto de originais próprios | Persistência real Blob ainda não validada | P1: edições invalidam exportação antiga |
| Exportação vídeo — novo | MediaRecorder/Canvas/áudio no dispositivo; MP4 somente com encoder H.264/AAC explícito; WebM só download | Navegador sem MP4 exige renderizador dedicado; nenhum worker pago provisionado | P1: decodificação real, limites e cancelamento |
| Capa — novo | Exporta JPEG e transporta instante do frame em `thumb_offset` para Reel | Contrato local coberto por 22 assertions; aceitação real pela Meta pendente | P2: capa local correta, recurso externo separado |
| Preview → calendário → fila — confirmado | Correção em implementação/teste nesta rodada | Ver resultados finais abaixo | P0: intenção explícita, snapshot e nenhuma publicação só por planejar |
| Post/Reel/Story/carrossel — confirmado | Adapters existentes; Story passa a aceitar imagem/vídeo; sete itens internos | Scopes, conta elegível, contrato Meta e App Review | P0: nenhuma resposta falsa de publicação |
| Processamento remoto Instagram — confirmado | Container FINISHED não é mídia publicada; reconciliação exige prova de objeto publicado | Campos/permissões Instagram Login precisam validação real | P0: container não pode virar PUBLICADO |
| Scheduler — confirmado | Endpoint autenticado e processo dedicado desativado por padrão; não depende de navegador | Hospedagem/disparador/frequência/capacidade/alertas a autorizar | P0: sem sobreposição e sem segredos em logs |
| Resultado incerto — confirmado | Quarentena e reconciliação admin auditável, com prova remota e revisão humana | Correspondência visual ainda humana; sem exactly-once externo garantido | P0: nunca limpar erro para reenviar às cegas |
| Dashboard/sync — confirmado | Existentes; renderização histórica com fixtures | Sync real e métricas Meta/TikTok pendentes | P1: números ausentes não são fabricados |
| Diagnóstico/score/ideias/copy/hashtags/mentoria — confirmado | Módulos existentes; teto de contexto combinado corrigido | Qualidade, respostas reais e custo monetário requerem provider aprovado | P1: dados insuficientes explícitos, revisão humana |
| Conhecimento/nichos — confirmado | Arquitetura existente, sem inventar metodologia proprietária | Material aprovado do dono | P2: separar dado observado/inferência/conteúdo proprietário |
| Rank/XP/metas/conquistas/histórico — confirmado | Existentes; regras gratuitas preservadas e evidência local anterior | Nem todas as combinações de progressão têm E2E | P2: números derivados dos dados persistidos |
| Inbox/FAQ/comentários/IA/aprovação — confirmado | Motores e guards existentes preservados | Mensagens reais, janelas e permissões pendentes | P0: nenhuma mensagem real nos testes |
| Comentário → Direct — confirmado | Arquitetura, isolamento e reservas locais anteriores | Teste de evento/entrega real autorizado | P0: sem duplicidade/spam |
| TikTok OAuth/publicação — confirmado | Código parcial; OAuth atual não concede automaticamente Direct Post | Scopes, conta/app e aprovação TikTok | P1: não anunciar integração operacional |
| TikTok webhook durável — pendência confirmada | Inbox e worker novos; remoção de autorização aplicada localmente | Eventos de publicação sem handler ficam em quarentena | P0: assinatura, dedupe, fencing, reconexão e rollback |
| Notificações/monitoramento — confirmado | Histórico e erros visíveis; não há outbox de entrega garantida | Canais, SLA, alertas e execução contínua precisam definição | P1: não prometer email/push durável |
| Visual de todas as páginas — confirmado | Design preservado; evidência anterior de páginas/tamanhos reaproveitada | Rodada nova concentra telas afetadas; dispositivos físicos pendentes | P1: sem redesign, overflow ou regressão nos casos executados |
| PWA/acessibilidade — confirmado | Política de cache e evidência anteriores preservadas | Instalação/toque/leitor/Safari físico pendentes | P1: nunca cachear HTML privado/API |
| CI/build/schema — confirmado | Workflow ampliado sem deploy; migrações novas são aditivas | CI remota não disparada | P0: schema/tipos/lint/build e testes proporcionais |

## Limites de mídia e infraestrutura

Editor de vídeo local: até doze trechos, vinte textos, 100 MB por original, dez minutos por original e três minutos na composição final; exportação 720 pixels de largura, dimensões pares e processo em tempo real. A exportação é interrompida se a aba for ocultada ou se o dispositivo perder o ritmo de quadros. Não há processamento pesado em função serverless. A API pode impor limites mais restritos por conta/formato; os limites do editor não são promessa de aceitação Meta/TikTok.

MP4 do navegador precisa passar pela validação de mídia existente; MIME sozinho não é inspeção completa de codecs/duração. WebM não é renomeado nem enviado como MP4. Arquivos maiores/dispositivos sem encoder adequado precisam de worker de renderização dedicado, cuja implantação, máquina, armazenamento e custo ainda não estão autorizados.

O limite de autorização de uploads por minuto passou de dez para vinte por usuário: um carrossel de sete originais e sete derivados exige quatorze autorizações. Limites de tamanho, plano, proprietário e MIME permanecem; não é mudança de franquia comercial. Arquivos enviados antes de cancelamento podem virar órfãos; não foi ativada limpeza destrutiva.

## Configuração futura — somente nomes

Além dos nomes já documentados no plano Preview: `ASAAS_CHECKOUT_ORIGIN`, `PUBLISHING_SCHEDULER_ENABLED`, `PUBLISHING_SCHEDULER_ORIGIN`, `PUBLISHING_SCHEDULER_INTERVAL_MS`, `TIKTOK_WEBHOOK_INBOX_ENABLED`, `SOCIAL_WEBHOOK_WORKER_ENABLED`. Reutiliza-se `CRON_SECRET` no receptor autenticado; todos os workers ficam desativados até aprovação própria. Configuração não prova destino, conta ou isolamento.

As novas migrações precisam entrar no plano de bootstrap vazio após a baseline. Não usar a antiga contagem de nove migrações como instrução para aplicar apenas parte do histórico atual. Banco existente exige inspeção de histórico/drift autorizada; jamais marcar baseline como aplicada por suposição. Não aplicar migrações no build.

## Testes, revisão e entrega

Retomada: branch e HEAD base continuam os mesmos; há mais de treze arquivos alterados, além de arquivos novos. Todos foram preservados. Foram relidos AGENTS, catálogo e este relatório, sem reiniciar auditoria. As tentativas interrompidas, permissões negadas e testes com mocks permanecem identificados; não são convertidos retroativamente em aprovação.

| Verificação | Resultado efetivamente obtido | Evidência / limite |
|---|---|---|
| `node bench/safe-run.mjs product` | APROVADO, nove suítes / 165 assertions | Logs `outputs/verification/test-*.log`; regras, request builders mockados, projetos, contratos e scheduler. Não são E2E externos |
| `node bench/integration-publishing.mjs` — reconciliação | APROVADO, 17 assertions | `outputs/publishing-reconciliation.log`: admin, IDs TikTok, concorrência, rollback; adapter local substituído |
| Mesmo driver — cadeia de migrações | APROVADO, 11 migrações, fixture preservada e sem drift | `outputs/publication-migrations.log`; PostgreSQL descartável novo, nenhuma conexão Neon |
| Mesmo driver — Preview/calendário/fila | APROVADO, 20 assertions | `outputs/editor-publishing.log`: planejamento gratuito, intenção premium, UTC, oito agendamentos concorrentes, snapshot/ordem imutável, seis workers, rollback e job remoto protegido |
| `node bench/integration-tiktok.mjs` | APROVADO, 28 assertions na rodada anterior desta implementação | `outputs/tiktok-inbox.log`; mantido como evidência, sem nova execução desnecessária |
| `node bench/test-media-render-browser.mjs` | APROVADO, 23 assertions, MP4 real | Chromium 156.0.8078.4; `outputs/editor-validation/render-results.json`; pixels de três layouts exportados, JPEG, capa, áudio/volume e cancelamento durante gravação |
| TypeScript / lint / Prisma validate | Aprovados antes das últimas correções de snapshots | Resultado histórico desta rodada; build final deve validar o código final |
| Build final exclusivo | NÃO APROVADO; tentativas interrompidas e falha de recurso registrada | Saída `outputs/product-build`; não há aprovação de build do código final |
| Editor completo no servidor Next | BLOQUEADO por falta de memória em 19/10 | `outputs/verification/editor-integration-dev/results.json`: initdb falhou com out of memory antes do servidor/browser; nenhuma assertion de UI executada nessa tentativa |
| Capa Reel | APROVADO separadamente, 22 assertions | `bench/test-reel-cover.mjs`; não equivale a envio real nem a nova execução conjunta da suíte product |
| Novos casos de publicação e XP | NÃO EXECUTADOS após as últimas alterações | Pipeline ampliado de 20 para 24 casos; gamificação com 29 assertions previstas; contagens previstas não são resultados |
| Diff | APROVADO `git diff --check`, exit 0 | Avisos de conversão LF/CRLF, sem erro de whitespace; não valida execução |
| Serviços externos e dispositivos físicos | NÃO EXECUTADOS | Aguardam autorização específica, contas de teste e dispositivos |

Correções identificadas por revisão e implementadas nesta retomada: Preview declara intenção explícita de publicação; calendário e fila persistem atomicamente; snapshot captura legenda e ordem dos derivados; reprogramação não pode substituir payload de job com ID remoto; TikTok lê o campo oficial `data.status`; edição de vídeo local pendente bloqueia salvar/programar/publicar a mídia anterior; remover o último trecho propaga projeto vazio.

A concorrência de agendamentos expôs conflitos únicos na concessão best-effort de XP/conquistas. A correção usa transação e lock por usuário, log idempotente, recompensa e flags atômicas; reconcilia conquista legada desbloqueada com recompensa pendente sem exigir novamente o limiar e sem alterar a data original. Os 29 novos casos de banco ainda não foram executados. Não recalcula saldos históricos automaticamente. O teste injeta falhas SQL deliberadas para provar rollback; erros sintéticos esperados são identificados nos logs.

### Bloqueio e próximos testes — retomada de 19/10/2026

O Windows reportou aproximadamente 24 MB livres em 3.885 MB de RAM. O PostgreSQL descartável falhou durante initdb ao solicitar 524.288 bytes, antes de iniciar Next ou Chromium. Não é evidência de regressão funcional da interface. Nenhum programa do usuário foi encerrado. Foi solicitado liberar memória; enquanto isso, não são iniciados novos processos pesados.

Após disponibilidade de memória, executar sequencialmente: `node bench/integration-publishing.mjs` (17 casos de reconciliação, 24 de pipeline e 29 de gamificação previstos); `node bench/integration-editor.mjs --dev --port=3110`; encerrar dev e executar `node bench/safe-run.mjs build-product`, além das verificações finais de tipos/lint/schema afetadas. Não executar banco/browser/build simultaneamente. Manter sanitização e bloqueio de APIs externas dos drivers. Não repetir a renderização de mídia já aprovada sem alteração que a afete.

### Estimativa de conclusão por módulo

Estimativas de engenharia, não métricas automáticas, com incerteza de aproximadamente dez pontos percentuais. Incluem implementação e validação operacional exigidas no comando mestre; testes locais e integrações reais são critérios diferentes. Nenhuma estimativa autoriza publicação.

| Módulo | Estimativa | Pendência principal |
|---|---:|---|
| Autenticação, onboarding e administração | 90% | Email/identidade em Preview e regressão final |
| Imagens, carrossel e rascunhos | 85% | Fluxo completo e persistência Blob reais |
| Vídeo e tela dividida | 80% | UI integrada, persistência e compatibilidade dos dispositivos |
| Publicação e scheduler | 80% | Novos testes, scheduler hospedado, notificações e prova remota |
| Asaas | 80% | Sandbox, recorrência e eventos reais |
| IA | 75% | Qualidade contextual e custos com provedor autorizado |
| Inbox, comentários e automações | 70% | Permissões, janelas e entrega real sem duplicidade |
| Dashboard, Growth e Rank | 75% | Testes da correção de XP e métricas reais |
| TikTok | 60% | Scopes/App Review e handlers de publicação pendentes |
| Responsividade e acessibilidade | 80% | Telas afetadas e dispositivos físicos |
| Banco, CI e infraestrutura | 75% | Build final, CI remota e Preview isolado autorizado |

Estado da entrega: código local revisável, não aprovado para produção. Branch `audit/finalizacao-inst-acessor`, base `d7a2b1f4ec656bcbb0231d15079c48bb950e8e65`, alterações não commitadas preservadas. Não houve push, merge, deploy, migração externa, pagamento ou publicação real. Inst Acessor Intelligence não foi iniciado.

## Checklist de publicação e rollback

1. Revisar diff/commit e decisões comerciais pendentes; preservar alterações locais anteriores.
2. Aprovar projeto Vercel dedicado, domínio, proteção e banco Neon novo descartável; comprovar IDs/destinos antes de conectar.
3. Aprovar leitura do banco e, separadamente, migrações no alvo identificado; validar histórico/schema e fixtures sintéticas. Nada de produção ou migration no build.
4. Configurar somente variáveis Preview e segredos novos; integrações e workers inicialmente desligados. Resolver acesso dos webhooks sem desproteger o aplicativo inteiro.
5. Aprovar explicitamente push/deploy Preview se forem necessários. Smoke test restrito; não usar produção como bancada.
6. Aprovar cada operação externa: Asaas Sandbox, Meta/TikTok de teste, Blob, IA e email, com contas/destinos/custos e remoção dos artefatos.
7. Validar tipos de conta, permissões, App Review, contratos reais, dispositivos físicos e recuperação antes de ativar automações.
8. Somente após as evidências, apresentar plano concreto de produção para nova aprovação.

Rollback: desligar schedulers e credenciais de teste, retirar Preview de circulação e voltar ao deployment aprovado anterior; preservar logs, eventos, IDs remotos e quarentenas. Não reenviar conteúdo incerto, desfazer cobranças ou aplicar DROP automaticamente. Migrações são aditivas; manter coluna/tabela não utilizada é mais seguro que destruir dados. Backups e restauração de produção continuam apenas planejados, sujeitos a aprovação específica.
