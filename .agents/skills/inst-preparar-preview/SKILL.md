---
name: inst-preparar-preview
description: Preparar isolamento, variáveis e gates de aprovação do Preview local ou Neon/Vercel do Inst Acessor. Não autoriza conexão, migração, push ou deploy.
---

# Preparar Preview isolado

Ler `../../../AGENTS.md`. Consultar conforme o alvo `../../../docs/NEON-PREVIEW-INICIAL.md` e `../../../docs/PREPARACAO-PREVIEW-2026-10-18.md`; tratar o estado desses documentos como registro histórico, não prova do ambiente atual.

1. Confirmar worktree/branch e identificar o que se quer visualizar. Reaproveitar validações anteriores; inspecionar somente comandos, dependências e consumidores de variáveis relevantes.
2. Não ler arquivos de credenciais originais. Preparar nomes de variáveis e armazenamento ignorado; nunca copiar ambiente de produção. Se faltarem serviços/variáveis necessários, informar antes de iniciar aplicação.
3. Para Neon, comprovar projeto/ID, branch, endpoint, banco e role no alvo novo antes de conectar. Pool e conexão direta devem apontar ao mesmo banco. Se ambíguo, parar; nome sozinho não prova isolamento.
4. Distinguir preparação local, conexão de leitura e migração. Obter autorização específica antes de cada operação externa ainda não autorizada. Banco inesperadamente preenchido interrompe bootstrap. Não executar migrations no build ou usar baseline resolve como atalho.
5. Para Vercel, planejar projeto separado, escopo Preview, branch, proteção e efeitos da conexão Git. Manter worker e integrações desligados até autorização própria. Asaas permanece oficial, sandbox somente quando aprovado.
6. Entregar pendências, próximo passo e operação concreta para aprovação quando necessária, sem URLs de banco ou segredos. Nunca apresentar endereço planejado como servidor em funcionamento.
