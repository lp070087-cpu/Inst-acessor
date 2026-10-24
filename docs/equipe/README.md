# Equipe de especialidades do Inst Acessor

As regras comuns estão no [AGENTS.md](../../AGENTS.md). Não há configuração TOML, servidores, modelos novos ou agentes persistentes nesta estrutura.

| ID | Instrução especializada | Triagem inicial | Skill própria/compartilhada |
|---|---|---|---|
| 01 | [Coordenador e arquiteto](papeis/01-coordenador.md) | Contratos e distribuição | `inst-coordenar` |
| 02 | [Frontend, mobile e acessibilidade](papeis/02-frontend.md) | `src/components`, páginas e CSS | — |
| 03 | [Backend e APIs](papeis/03-backend.md) | `src/app/api`, regras de domínio | — |
| 04 | [Segurança e autenticação](papeis/04-seguranca.md) | Auth, middleware, assinaturas | — |
| 05 | [Banco, Neon e Prisma](papeis/05-banco.md) | `prisma`, camada de dados | `inst-preparar-preview` compartilhada |
| 06 | [Instagram, Meta e TikTok](papeis/06-redes-sociais.md) | OAuth, webhooks e publicação | — |
| 07 | [Inteligência artificial](papeis/07-ia.md) | Provedores, prompts e uso | — |
| 08 | [Pagamentos e Asaas](papeis/08-asaas.md) | Billing, checkout, acesso | — |
| 09 | [Testes automatizados](papeis/09-testes.md) | `bench`, testes direcionados | — |
| 10 | [Qualidade funcional e visual](papeis/10-qualidade.md) | Fluxos e responsividade | — |
| 11 | [Infraestrutura e Preview](papeis/11-infraestrutura.md) | Next, Vercel e ambiente | `inst-preparar-preview` compartilhada |
| 12 | [Revisor independente](papeis/12-revisor.md) | Diff e critérios da tarefa | `inst-revisar-entrega` |

Todos podem orientar um agente delegado quando as ferramentas da sessão permitirem; a especialidade vem da instrução, não de um parâmetro `agent_type`. O coordenador principal normalmente exerce o papel 01. Os demais papéis são acionados conforme o problema, respeitando quatro agentes ativos no total nesta sessão.

## Como solicitar

- “Use a equipe para ajustar a navegação mobile; sem serviços externos.” O coordenador seleciona frontend e qualidade; testes somente se o comportamento justificar.
- “Use `$inst-preparar-preview` para preparar o ambiente, sem conectar ou publicar.” Se a Skill não aparecer no catálogo, pedir leitura de `.agents/skills/inst-preparar-preview/SKILL.md`.
- “Peça revisão independente desta alteração.” Acionar papel 12 e especialistas de domínio quando houver risco concreto.

Skills cobrem procedimentos, não duplicam os doze papéis. Não é necessário abrir doze painéis. A descoberta automática das Skills deve ser confirmada no catálogo de uma nova sessão do VS Code; a leitura explícita funciona como alternativa. Não há promessa de registro automático ou de doze agentes simultâneos.

## Simulação sem execução funcional

Pedido: “Planeje uma prévia mobile do dashboard com dados fictícios e sem banco.”

1. Coordenador lê 02, 10 e 11. Não chama banco, redes, IA ou pagamentos, pois nenhum desses serviços deve ser usado.
2. Primeira rodada: frontend propõe apresentação (somente leitura de `src/components/dashboard/` e página); infraestrutura verifica isolamento e variáveis sem ler segredos; qualidade define critérios de 390 × 844, teclado, foco e navegação. Coordenador + três delegados = quatro ativos.
3. Cada delegado recebe entrega de texto, sem arquivos graváveis, sem iniciar servidor e sem modificar funcionalidades. Nenhuma disputa de arquivos.
4. Encerrada a rodada, revisor independente verifica a proposta e registra dependências/bloqueios. Não fica ativo junto com os três anteriores.
5. Entrega: plano de prévia e condições para iniciar; qualquer implementação funcional depende de solicitação própria. Esta simulação descreve a seleção, não executa o plano.
