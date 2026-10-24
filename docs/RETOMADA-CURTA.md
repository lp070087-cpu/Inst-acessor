# Retomada curta

- Original: `preview-ajustes`, `fcd81bbfca71a23aa2b050d12597fa55d4d7501d`, confirmado limpo.
- Implementação: `audit/finalizacao-inst-acessor`, worktree `.audit-worktree`. Preservar todas as alterações. Não reiniciar auditoria.
- Usuário escolheu expressamente somente validação local. Sem push, merge, deploy, banco/serviços reais, OAuth, cobrança, publicação, mensagem, IA paga ou email.
- Dependências já instaladas. Usar `bench/safe-run.mjs`, que sanitiza ambiente; nunca usar `.env` original como fallback.
- Banco descartável próprio, porta loopback livre explícita. Testes com destino exato e dados `@audit.invalid`. Clusters antigos permanecem ignorados em outputs; não são produção.
- Matriz ampliada: 202 observações/13 tamanhos, sem overflow; encontrou Rank sem labels/contraste, hidratação intermitente no calendário e expectativas erradas para redirect legado. Correções aplicadas; regressão focada preparada em `e2e-regression`, Edge em `e2e-edge`.
- Medidor de uso tinha advisory lock com dois bigint onde PostgreSQL exige integer. Corrigido e teste concorrente incluído. Política comercial permanece em medição.
- Regressão focada aprovou 115 assertions de UI/acesso e zero violações Axe, mas o gate de servidor encontrou prioridade numérica em GrowthAction.priority (String). Mapeamento corrigido; regressão Growth no Chromium e rodada Edge são os testes afetados finais. Mocks de imagens fictícias não saem para a rede.
- Guardas alinhadas: Rank/Growth/ponte legada gratuitos; biblioteca/publicação seguem `PREMIUM_ROUTES`; APIs de ideias/mentoria protegidas. Gerador de Copy redireciona legitimamente para Preview Social.
- Resultados finais: build/tipos/lint/schema aprovados; 57 assertions de banco; 306 checks offline agregados; Chromium Growth 16 aprovados; Edge 115 UI/acesso aprovados, gate 404 do favicon corrigido e 14 testes de assets aprovados nos dois navegadores. Não confundir o exit 1 da rodada antiga com aprovação integral retroativa. Ver `docs/RESULTADO-VALIDACAO-LOCAL.md`.
- Commit local da entrega e lista de arquivos ficam nas evidências `git-delivery.txt`/`changed-files.txt`. Nenhum push, merge ou deploy. Processos remanescentes conhecidos da bancada antiga foram encerrados; arquivos sintéticos preservados.
- Pendências externas e deploy: `docs/PLANO-VALIDACAO-EXTERNA-E-DEPLOY.md`. Próxima fase proposta em `docs/PROXIMA-ETAPA-INTELLIGENCE.md`, sem implementação autorizada.
