# Inst Acessor Intelligence — proposta, sem implementação autorizada

Primeiro concluir a validação operacional da versão existente em preview isolado e contas de teste. Nenhuma funcionalidade abaixo foi implementada nesta entrega.

| Evolução | Reaproveitar | Criar apenas após aprovação |
|---|---|---|
| Gestor de Perfil | Perfil de inteligência, diagnóstico, score, mentoria, snapshots e growth | Orquestração de metas/tarefas, memória por usuário, acompanhamento e aprovação de ações |
| Radar de Reels e Tendências | Métricas próprias, biblioteca, ideias e contexto da IA | Entrada de referências autorizadas, ingestão conforme contratos oficiais, deduplicação e análise de originalidade; sem scraping não autorizado |
| Plano de 30 dias | Calendário, plano semanal, ideias, copy, rascunhos e experimentos | Geração em lotes revisáveis, objetivos/roteiros por dia, orçamento e aceite antes de persistir/publicar |
| Inteligência de Público | Perfil, diagnóstico e agregados disponíveis | Personas com evidência e nível de confiança; separar inferência de dado observado; sem inventar dados pessoais |
| Segurança de IA | Provider central, autenticação, propriedade, limites e medição | Conteúdo externo tratado como dado, ferramentas por allow-list, segregação de memória/usuários, avaliação de prompt injection/vazamento e trilha de aprovação |
| Prospecção Comercial | Contexto de perfil e recomendações | Escopo e fontes aprovados em fase posterior; nenhum contato comercial automático |

Sequência sugerida: fechar pendências da versão atual → aprovar escopo e critérios do Gestor → implementar planejamento revisável de 30 dias → validar Radar/Público com fontes permitidas → considerar prospecção separadamente. Manter Asaas e a arquitetura existente. Medir custo/qualidade com dados fictícios antes de liberar para usuários.
