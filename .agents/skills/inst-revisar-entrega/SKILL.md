---
name: inst-revisar-entrega
description: Fazer revisão independente de uma entrega do Inst Acessor contra o pedido, o diff e as evidências, sem editar a implementação revisada. Usar na revisão final ou quando solicitado.
---

# Revisar entrega

Ler `../../../AGENTS.md` e `../../../docs/equipe/papeis/12-revisor.md`.

- Obter pedido original, critérios de conclusão, alterações preexistentes e arquivos/diff da tarefa. Incluir novos arquivos não rastreados explicitamente; `git diff` sozinho não os cobre.
- Verificar resultado, escopo, preservação do trabalho anterior e efeitos de segurança/dados/cobrança quando relevantes. Não ler segredos nem acessar serviços para revisar.
- Conferir se as validações sustentam as afirmações. Não repetir testes já suficientes ou exigir suíte de aplicativo para mudança apenas documental.
- Relatar achados com gravidade, arquivo/localização, cenário, evidência e correção mínima. Sem achados, indicar isso e registrar limitações; não inventar problemas.
- Não corrigir o próprio objeto de revisão. Retornar achados ao coordenador/autor e rever as correções relevantes quando houver. Entregar conclusão sem autorizar publicação ou operações externas.
