# Retomada local — Inst Acessor — 19/10/2026

## Base e preservação

Worktree: C:/Users/55819/Desktop/Inst Acessor/.audit-worktree. Branch confirmada: audit/finalizacao-inst-acessor. Nenhuma troca de branch, reset, limpeza, push, merge, deploy, operação em produção ou serviço externo. AGENTS.md, catálogo dos 12 papéis e relatório anterior foram lidos. Coordenador e até três delegados em leitura, com responsabilidades por editor/qualidade, publicação/banco/segurança e Asaas/IA/revisão.

Havia 33 arquivos rastreados modificados e diversos novos, portanto a referência a 13 alterações não descreve o estado integral encontrado. Todo esse conjunto foi mantido. Uma outra sessão modificou arquivos durante a retomada; o usuário informou que recebeu ordem para parar. A checagem de processos não encontrou build/teste do Inst Acessor concorrente. Não existe lock exclusivo que impeça uma ferramenta de iniciar depois da checagem. Baseline da retomada em outputs/verification/resume-2026-10-19: status.txt, tracked.patch e hashes.json; não contém valores de ambiente. Nenhum arquivo de credenciais foi lido.

## Correções desta retomada

- Prévia de vídeo: carregamento em andamento fica em cache por URL, independente do tick de reprodução; remoção da fonte e desmontagem cancelam a leitura. Paint antigo não religa vídeo/áudio depois de seek.
- Importação: metadados inválidos não invalidam o último projeto/export válido. O pai bloqueia salvar/agendar/publicar temporariamente enquanto o editor está ocupado; desmontagem libera esse estado.
- Tela dividida: a seleção e importação de JSON recusam duas fontes com a mesma URL; projeto histórico nessa configuração mantém seus dados, mostra aviso e bloqueia reprodução/export até correção. Exportador falha antes de alocar recursos. O suporte a dois decodificadores simultâneos do mesmo original continua pendente.
- Bancada: novos cenários de importação inválida, reprodução com segunda fonte atrasada 700 ms e pixels da composição, rejeição de JSON duplicado. As esperas observam a reabertura efetiva do projeto. Token fictício inclui tipos de vídeo.
- Build: modo build-product-serial termina lint antes do build; o build mantém verificação de tipos, usa um worker e otimização de memória somente no output isolado. Nenhum ajuste no sistema operacional.

Alterações da outra sessão também preservadas: serialização transacional de XP/conquistas, reparação de recompensa histórica, cobertura de capa do Reel/snapshot e matriz visual do editor em 13 tamanhos/orientações. Não atribuir essas implementações ao coordenador desta retomada.

## Evidência confirmada

| Verificação | Resultado | Limite |
|---|---|---|
| PostgreSQL novo e cadeia histórica | 11 migrações; fixture preservada; sem drift | Somente loopback descartável; nenhum Neon |
| Reconciliação | 17 assertions aprovadas | Adapter local substituído; nenhuma publicação |
| Preview/calendário/fila | 24 assertions aprovadas | Snapshot, capa, UTC, concorrência e rollback locais |
| XP/conquistas | 29 assertions aprovadas | Recompensas únicas, transação aninhada, rollback e reparação histórica |
| Revisão dos logs de publicação/XP | Sem P2002 nos logs finais | P0001 deliberado comprova rollback; não é falha espontânea |
| Build anterior e tentativa com um worker | Compilação passou; processo saiu 134 durante lint/tipos por falta de memória | Não aprovado; log preservado em resume-2026-10-19/build-product-oom.log |
| Lint sequencial | APROVADO, exit 0; avisos existentes | outputs/verification/lint-product-serial.log |
| Build sequencial | APROVADO, exit 0; compilação, tipos e geração concluídos | outputs/verification/build-product-serial.log; lint executado antes, não omitido |
| Editor completo, exportação e matriz visual | PENDENTES DA EXECUÇÃO ATUAL | Fixtures e protocolo Blob/Biblioteca mockados |

Logs: outputs/publication-migrations.log, outputs/publishing-reconciliation.log, outputs/editor-publishing.log e outputs/gamification-concurrency.log. Suíte de XP foi chamada duas vezes na primeira execução do driver, por sobreposição de inserções; as duas passaram. A chamada redundante adicionada pelo coordenador foi removida, preservando a chamada equivalente da outra sessão. Não contar como 58 cenários distintos.

Evidência anterior reaproveitada, sem nova execução desnecessária: contratos Asaas (29 checks), orçamento de IA (27 checks), inbox TikTok (28 assertions). Os resultados puros e de renderização anteriores continuam históricos, sem serem apresentados como execução atual.

## Pendências externas preservadas

Asaas Sandbox real (origem hospedada, PIX/cartão, recorrência, cancelamento, estorno, chargeback e reentrega); Meta/TikTok (contas elegíveis, permissões, App Review, OAuth, status e publicação real); Blob real e registro autenticado; IA real, qualidade/custo e material proprietário; email; execução contínua do scheduler e alertas; Safari/iOS/Android e dispositivos físicos. Nenhum desses itens foi liberado operacionalmente.

As estimativas de conclusão por módulo serão fechadas após os resultados locais. Não significam aprovação de produção.
