# Inst Acessor — coordenação do Codex

## Escopo e proteção

- Trabalhar exclusivamente neste worktree `.audit-worktree`, branch `audit/finalizacao-inst-acessor`. Confirmar diretório, branch e `git status --short` ao começar. Se divergirem, parar antes de editar; não trocar branch automaticamente.
- Preservar alterações existentes, inclusive arquivos não commitados. Não limpar, sobrescrever ou reverter trabalho alheio.
- Não alterar main, checkout original ou aplicação publicada. Não fazer push, deploy, publicação, merge, migrações ou conexões externas sem autorização explícita específica em tarefa futura. Nesta implementação de arquitetura, todas essas operações permanecem proibidas.
- Não ler, copiar, reutilizar ou imprimir credenciais de produção. Segredos de Preview ficam somente em armazenamento local ignorado ou ambiente autorizado; nunca em mensagens, patches ou logs.
- Asaas é o gateway oficial. Não adicionar gateways alternativos. Recursos Neon/Vercel de Preview devem ser separados dos originais. Nome de projeto e etiqueta sandbox não bastam para provar o destino.
- Não instalar dependências, repetir auditorias ou executar testes amplos sem necessidade concreta. Não iniciar Next.js quando depender de serviços ou variáveis não configurados; informar a pendência primeiro.

## Papéis e leitura sob demanda

O coordenador usa o [catálogo](docs/equipe/README.md) e lê somente as instruções dos especialistas necessários. Os doze papéis são especialidades lógicas, não processos permanentes nem novos tipos nativos de agente. Os arquivos em `docs/equipe/papeis/` são instruções explicitamente lidas, não descoberta automática de agentes.

Skills locais ficam em `.agents/skills/<nome>/SKILL.md`, com frontmatter `name` e `description`. Se o catálogo da sessão ainda não as listar, ler o caminho explicitamente; não presumir recarregamento imediato. Reutilizar Skills globais disponíveis quando apropriado, especialmente `skill-creator`, `openai-docs`, documentos e visualizações, sem duplicá-las nem ampliar permissões.

## Delegação e propriedade dos arquivos

1. Entender resultado esperado e permissões; selecionar o menor conjunto de especialistas. Tarefas pequenas podem ser realizadas pelo coordenador com as instruções do papel.
2. Limite confirmado nesta sessão: quatro agentes ativos, incluindo coordenador. Usar no máximo três delegados simultâneos; em outra sessão, conferir ferramentas e limite antes de delegar. Sem ferramenta de delegação, aplicar os papéis sequencialmente e informar isso.
3. Antes de iniciar cada delegado, enviar objetivo, instrução do papel, contexto mínimo, lista EXATA de arquivos graváveis, arquivos somente de leitura, verificações permitidas e entrega esperada. Reservar cada arquivo para apenas um editor ativo. Diretórios no catálogo orientam triagem, não concedem propriedade automática.
4. Arquivos compartilhados (schema, lockfile, configurações, layouts, validadores e rotas com vários domínios) têm um único responsável nomeado. Outros especialistas entregam recomendações; se precisarem editar, pedir transferência ao coordenador antes.
5. Delegados não iniciam novos subagentes sem reserva de vaga pelo coordenador. Não elevar permissões ou agir externamente por conta própria. Comunicar bloqueios e retornar evidências, arquivos alterados e verificações realizadas/não realizadas.
6. Coordenador integra resultados, resolve contratos e solicita revisão independente proporcional ao risco. Revisor começa em leitura e não aprova o próprio trabalho. Achados voltam ao autor; nova revisão somente onde houve correção ou dúvida relevante.

## Critérios de conclusão

- Resultado solicitado atendido, diff restrito ao escopo e alterações preexistentes preservadas.
- Validações proporcionais realizadas; limitações e pendências descritas honestamente. Documentação sem mudança funcional não exige build ou testes do aplicativo.
- Mudanças de autenticação, cobrança, dados ou efeitos externos recebem revisão independente de segurança/domínio quando relevante.
- Entrega informa o que mudou, evidência de validação, riscos remanescentes e próximo passo; não declara deploy ou integração pronta sem comprovação.
- Aprovação futura identifica projeto/ambiente e operação concreta. Preparação de plano não autoriza sua execução.
