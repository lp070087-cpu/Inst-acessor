# Arquitetura e escopo verificado

Esta descrição corresponde à branch `audit/finalizacao-inst-acessor`. Código implementado, teste local e integração operacional são níveis distintos de evidência. O relatório histórico não prova o estado desta branch.

## Componentes

- Next.js App Router: páginas públicas, grupo `(auth)`, grupo `(app)`, administração e Route Handlers em `src/app/api`. React e Tailwind compõem a interface. Fontes estão versionadas em `src/app/fonts`, com licenças.
- NextAuth Credentials: sessão JWT, senha bcrypt, consulta de status atual, revogação por versão da senha. Guardas de página e API verificam sessão, identidade, administrador e direito premium no servidor.
- PostgreSQL/Prisma: `src/lib/db.ts` mantém cliente por processo e contexto assíncrono de transação. `prisma/schema.prisma` define os dados. Neon é a hospedagem prevista pelo projeto; nenhuma instância Neon foi consultada nesta execução.
- Billing: catálogo, promoção, capacidade e medição em `src/lib/billing`; Asaas permanece gateway oficial. Checkout gera ordem no servidor. Webhook valida token e aplica Payment/Subscription/AccessGrant/BillingEvent em transação. Notificações pós-commit são best-effort; não existe promessa de entrega garantida.
- Publicação: `src/lib/publishing` valida conteúdo, controla fila e chama adapters Instagram/TikTok. Claim por atualização condicional; estados incertos ficam em conferência para evitar duplicação. Cron autenticado em `/api/cron/publishing`, desativado por padrão. Nenhum scheduler Vercel foi configurado.
- Integrações sociais: OAuth e callbacks em `src/app/api/integrations`, clientes e tokens em `src/lib/integrations`. State é consumido atomicamente. Scopes, App Review, contas profissionais e contratos reais dependem da validação externa autorizada.
- Comentários e Direct: motores separados em `src/lib/comment-replies` e `src/lib/comment-direct`. Reservas transacionais por usuário limitam envios concorrentes. Webhook Instagram assinado distribui eventos; falha parcial não recebe confirmação de sucesso. Processamento durável TikTok permanece indisponível e retorna 503.
- Mídia: browser transfere diretamente ao Vercel Blob usando token autorizado pela rota de upload. Biblioteca mantém referências por proprietário. Registro confere URL real, metadados do store e primeiros bytes. Isso não equivale a antivírus, decodificação completa ou validação real do serviço Blob.
- IA: rotas e serviços para conversas, copy, ideias, score, mentoria e perfil; growth, conhecimento e experimentos usam os módulos de domínio. Testes de regras/allow-list não comprovam resposta real de Gemini/OpenAI.
- PWA: manifest e service worker em `public`. Cache limitado a estáticos conhecidos; navegação HTML, APIs e requisições explicitamente autenticadas passam pela rede. Instalação e comportamento em dispositivos reais continuam pendentes.
- CI: workflow verifica schema, tipos, lint, testes offline, integração, build e Chromium. Não contém deploy. Arquivo preparado localmente; nenhuma execução remota do GitHub Actions foi disparada.

## Estado dos módulos

| Área | Implementação local | Evidência e limite |
|---|---|---|
| Cadastro/onboarding/primeiro acesso | Existente, proteções reforçadas | Ativação concorrente e recuperação de cadastro fictício testadas; email real pendente |
| Premium/grants/planos/promo/capacidade | Existente, efeitos financeiros protegidos | Regras offline e banco local; franquias continuam em medição |
| Checkout Asaas | Existente | Parser, autenticação e efeitos locais; URL hospedada, recorrência e estorno reais sandbox pendentes |
| Dashboard/sync | Existente | Renderização com dados fictícios; sync real Meta/TikTok pendente |
| Upload/biblioteca | Existente, validação reforçada | Política e isolamento locais; upload/download/delete reais Blob não executados |
| Rascunhos/preview/calendário | Existente | CRUD e responsividade incluídos na bancada; cenários ricos/carrossel precisam expansão |
| Publicação/agendamento/cancelamento/retry | Existente, claim e quarentena implementados | Concorrência real de banco e adapter fictício; publicação externa não executada |
| IA/copy/ideias/score/mentoria | Existente | Regras e renderização; geração real, custo e qualidade dependem de projeto de teste autorizado |
| Growth/conhecimento/experimentos/rank/metas | Existente | Renderização/regras locais; não afirmar cobertura E2E de toda combinação funcional |
| Comentários/aprovação/automático/Direct/inbox/FAQ | Existente, reservas reforçadas | Concorrência local; envio/recepção real e escopos não aprovados |
| Administração | Existente, APIs protegidas | Identidades sintéticas e regra de admin único; configuração real não consultada |
| TikTok webhook | Parcial | Autenticação existe; worker durável ainda não implementado |

## Decisões e riscos para revisão

1. A atualização para Next 15/React 19 é ampla. Os testes locais reduzem risco, mas não substituem preview autorizado e revisão do diff.
2. Locks financeiros são globais por transação nesta implementação: simplificam integridade, porém limitam throughput. Medir carga antes de escalar. Não declarar prova de todos os possíveis pontos de crash com apenas os casos de falha injetada cobertos.
3. Não existe garantia de exactly-once na rede dos provedores. Sem confirmação confiável, publicação/comentário/Direct fica bloqueado em conferência. A operação precisa de procedimento de reconciliação e eventual tela administrativa; não limpar o claim para reenviar.
4. Contas históricas com `firstAccessCompleted` são tratadas como verificadas. Revisar a origem desse campo em staging. JWTs antigos requerem novo login; mudança intencional de segurança.
5. Biblioteca antiga pode conter URLs que não passam pela nova política. Não removê-las automaticamente. Revisar migração de referências e compatibilidade com arquivos legítimos em staging.
6. Limpeza de órfãos deve começar com inventário/dry-run, cruzar referências em rascunhos, carrosséis, fila e publicações, manter carência e registro, e só apagar após autorização do armazenamento de teste. O fluxo antigo de exclusão e sua corrida com novas referências precisam de revisão adicional; não ativar limpeza automática em produção.
7. Rate limit de banco é compartilhado e fecha em falha. Proteção volumétrica de entrada/tamanho do corpo e confiança em headers de IP precisam da configuração de proxy/WAF da hospedagem, não verificada localmente.
8. A matriz visual registra as páginas e tamanhos efetivamente executados; não cobre todos os estados vazios/preenchidos/erro, teclado virtual, leitor de tela ou versões históricas de navegador.

## Política de suporte proposta

Desktop e emulação: versões exatas registradas na evidência local. Para suporte comercial, adotar versões estáveis atual e anterior de Chromium/Edge e Safari/iOS/Chrome Android suportados pelos fornecedores, **somente após validação em dispositivos disponíveis**. Não prometer “todas as versões”. CSS zoom 200% é evidência de reflow local, não comprovação do zoom nativo de todos os navegadores.
