# Finalização em branch isolada — 17/10/2026

## Checkpoint 0

Original confirmado limpo em `preview-ajustes`, commit `fcd81bbfca71a23aa2b050d12597fa55d4d7501d`. Implementação em `audit/finalizacao-inst-acessor`, checkout `.audit-worktree`. Nenhum AGENTS.md encontrado no projeto ou pais examinados. Nenhuma credencial de `.env*` foi copiada. A branch original, main e produção não foram alteradas.

## Bancada

`bench/safe-run.mjs` cria ambiente por allow-list, usa segredos fictícios e bloqueia saída de rede dos processos de aplicação por preload. O guard é uma defesa da bancada, não substitui isolamento de rede do sistema/CI. Prisma usa processo nativo: a defesa de banco é URL explícita e validação exata de destino, nunca confiar apenas no interceptador Node.

- Testes puros: banco fictício em `127.0.0.1:1/inst_acessor_audit`.
- Integração: PostgreSQL iniciado pela própria bancada em `127.0.0.1`, porta livre escolhida e transmitida explicitamente ao processo de teste, banco `inst_acessor_audit`; cluster novo em `outputs/postgres-<timestamp>`, encerrado no finally. Nenhum servidor pré-existente é utilizado. Não existe usuário criado no sistema operacional. A porta fixa anterior conflitou com processo remanescente; o gerenciador nativo substituiu a inicialização anterior, sem reutilizar esse servidor.
- Seeds são fixtures sintéticas criadas exclusivamente nesse banco descartável. Emails `@audit.invalid`; nenhuma mensagem é enviada.
- E2E inicia o próprio Next local em `127.0.0.1:3107`, usa login com senha sintética e bloqueia requisições externas no navegador. Nenhum cookie real é reutilizado.
- Instalações consultam o registro npm para ferramentas e dependências; isso é separado dos processos de teste sem credenciais de serviços.

## Correções locais

- Webhook genérico exige App Secret e assinatura antes do banco/parse. Evento sem proprietário resolvido não grava usuário fictício. Recepção genérica não executa automações.
- Publicação: owner-check no claim atômico, transições condicionais, cancelamento recusa itens em processamento; worker interrompido ou resultado incerto fica em conferência. POST não é repetido no cliente HTTP. A conferência deliberadamente não faz novo envio automático.
- Quando existe ID externo de publicação, o retry consulta status desse ID antes de qualquer novo envio. Comentários e Direct também reservam execução atomicamente, com contagem compartilhada de envios/reservas, proteção contra reanálise que reseta um envio e verificação de conta/plano. Processamento parcial de webhook Instagram retorna erro para permitir reentrega; itens já reservados/enviados não são reenviados.
- Asaas: efeitos e conclusão do evento na mesma transação; lock consultivo transacional global serializa processadores deste aplicativo. Reentregas de CONFIRMED/RECEIVED da mesma cobrança não estendem duas vezes. Estorno/chargeback anterior impede reativação por confirmação atrasada. Email best-effort ocorre somente após commit.
- OAuth Instagram/TikTok e primeiro acesso: consumo condicional atômico. Ativação e vínculo da conta na mesma transação.
- Sessão consulta status atual; APIs premium e administrativas recebem guardas de autenticação/autorização. ADMIN_EMAIL substitui o administrador padrão, preservando a regra de um único email autorizado. Esta alteração de código requer conferência do valor configurado antes de qualquer deploy; nenhum privilégio real foi alterado.
- Cadastro novo não pode assumir grants apenas informando email. Ativação por token registra emailVerified, substitui senha de cadastro ainda não verificado e revoga JWTs ligados à senha anterior. Contas históricas com firstAccessCompleted são preservadas como identidades já ativadas; revisar essa premissa em staging antes do rollout. JWTs anteriores à versão de autenticação exigirão novo login.
- Rate limit compartilhado por banco e lock da janela. Falha fecha por padrão; opção failOpen só para caminhos explicitamente escolhidos. Chaves com email/IP são hash antes de persistir.
- Upload valida o pathname original, recusa segmentos de travessia e restringe MIME permitido. Registro na biblioteca exige URL real da pasta, metadados do Blob e assinatura dos primeiros bytes via conexão DNS fixada e leitura limitada. Testes locais de política não equivalem a transferência real, antivírus ou decodificação completa. Limpeza segura de órfãos e compatibilidade de referências históricas continuam pendentes.
- Probe de mídia verifica URL, DNS público e fixa endereço de conexão sem redirects. Não afirmar que qualquer URL é propriedade do usuário apenas por ser pública.
- Cron preparado com Bearer CRON_SECRET e PUBLISHING_WORKER_ENABLED=false por padrão, um item por invocação. Nenhum cron externo foi cadastrado. Necessário confirmar limites de duração e frequência do plano de hospedagem antes de ativar.
- Fontes locais licenciadas mantêm as famílias originais e retiram download de Google Fonts durante build. ESLint explícito, scripts de verificação e CI sem deploy.
- TikTok webhook responde 503 quando processamento durável não está implementado; não confirma recebimento sem persistência.

## Política comercial preservada

Franquias continuam em medição. Não ativar enforcement silenciosamente. Painel deve explicar esse estado. Rate limit defensivo de requisições não equivale à franquia comercial contratada.

A revisão final encontrou divergências pré-existentes: `PREMIUM_ROUTES` inclui biblioteca e publicação, mas essas páginas não exigiam plano no servidor; foram alinhadas ao catálogo existente. Rank declara explicitamente acesso a todos os planos; suas APIs e Growth/ponte de automações usam proteção de sessão, sem novo bloqueio premium. Preview e biblioteca de copies salvas continuam acessíveis por sessão; geração de IA permanece protegida. Essa distinção é verificável no código e deve constar da revisão de produto.

## Histórico de migrações

A baseline `20260901000000_baseline_historico` foi reconstruída a partir do schema no commit `57f8606`, anterior à restauração de billing. Migrações antigas permanecem intactas. O alinhamento `20261017190000_alinhamento_historico` adiciona quatro tabelas de respostas a comentários ausentes no histórico, ajusta dois defaults de arrays e renomeia um índice para corresponder ao schema. Nenhuma tabela/coluna/dado é removida. A bancada verifica criação vazia, preservação de usuário sintético entre migrações e diff final do schema.

Para banco existente: não aplicar a baseline cegamente. A existência e o estado real das tabelas de produção não foram consultados. É obrigatório revisar o plano de baseline/resolve e drift em staging autorizado antes de qualquer deploy; isso continua sujeito à aprovação do proprietário.

## Fontes oficiais consultadas

- [Eventos de cobrança Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas): nomes de estorno e chargeback usados na allow-list.
- [Migração Next 15](https://nextjs.org/docs/app/guides/upgrading/version-15): React e APIs assíncronas de parâmetros/headers.
- [Aviso de segurança Next em Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36): motivação adicional para atualizar o framework. Auditoria npm sanitizada em outputs/verification.

## Pendências externas e autorização

Antes de qualquer operação externa, preparar lista de contas e efeitos: checkout/recorrência/estorno exclusivamente Asaas sandbox; OAuth/sync/publicação/comentário/DM exclusivamente contas Meta/TikTok de teste; IA com teto de custo; emails somente destinos de teste. Sem autorização específica, esses casos continuam não executados.

Nenhum deploy/merge/main/migração de produção está autorizado. Antes de solicitar aprovação, entregar diff, resultados atuais, matriz de casos e rollback. Não considerar o aplicativo operacionalmente finalizado enquanto integrações externas e dispositivos reais permanecerem sem validação.
