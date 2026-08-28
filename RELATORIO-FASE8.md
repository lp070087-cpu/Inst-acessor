# RELATÓRIO — FASE 8: AUTOMAÇÕES INTELIGENTES + MOTOR OPERACIONAL DE CRESCIMENTO

**Data:** 2026-08-28
**Projeto:** Inst Acessor — SaaS de crescimento para Instagram/TikTok
**Stack:** Next.js 14.2.35 (App Router) · TypeScript 5.5.4 strict · Tailwind · Prisma/Neon · Auth.js
**Status da Fase:** ✅ IMPLEMENTADA (30/30 partes) · ⏸ SEM commit/push (aguarda validação local da DONA)

---

## 1. Resumo executivo

A **Fase 8** construiu o **Motor Operacional de Crescimento (Growth Engine)** — um pipeline determinístico que converte dados reais (Instagram/TikTok sincronizados) em sinais, prioridades, recomendações acionáveis, plano de ação rastreável (GrowthAction), missão do dia, planos de 7 e 30 dias, insights proativos e automações internas seguras.

Regra absoluta respeitada: **nunca inventar dados**. Quando faltam dados reais, o motor declara `DADO INSUFICIENTE` e reduz a confiança — em vez de sugerir números fictícios.

### Entregas principais
- **`src/lib/growth-engine/`** — 15 módulos (engine, signals, priorities, recommendations, actions, progress, insights, automations, context, pipeline, prompt, errors, db, types, index)
- **`/growth`** — página "Automações Inteligentes" (Missão do Dia, Prioridades, Sinais, Automações internas, Recomendações, Ações, Planos 7/30 dias, O que mudou)
- **`/api/growth/engine`** — pipeline completo consolidado (`runGrowthPipeline`)
- **`/api/growth/actions`** — CRUD + conclusão com XP idempotente
- **`/api/growth/alertas`** — alertas inteligentes (evolui `/api/alertas` sem duplicar)
- **Dashboard** — seção "Automações Inteligentes" com Missão do Dia, Prioridades e Sinais
- **IA Acessor** — usa GrowthContext + distingue DADO REAL / INFERÊNCIA / RECOMENDAÇÃO / DADO INSUFICIENTE
- **23 testes determinísticos** (Parte 28) — sem APIs externas, 23/23 passando

### Persistência nova (única)
- `model GrowthAction` — única tabela nova da Fase 8 (plano de ação real). Reutiliza UserGoal, GrowthExperiment, XpLog, PlannedContent etc. das fases anteriores.

---

## 2. Auditoria obrigatória (Parte 1 / REGRA 1)

Realizada **antes de qualquer edição**:
- `git status` — confirmado estado com Fases 1-7 íntegras
- `git diff --stat` — 28 arquivos modificados + ~20 diretórios novos (Growth Engine, Publishing, Planning, Gamification, Billing das fases 5-7)
- `git log` — último commit f6b7583 (Fase 7 completa, push pendente)
- Nenhum `git reset`/`checkout`/`revert` executado — Fases 1-7 preservadas integralmente

---

## 3. Implementação por parte

### PARTE 2 — Growth Operating System (`src/lib/growth-engine/`)
Criados 15 módulos. O coração é o pipeline:

```ts
dados reais → sinais → prioridades (máx 3) → recomendações acionáveis →
  ações (GrowthAction) → missão do dia → planos 7/30 dias → insights proativos
```

- `engine.ts` — `runGrowthEngine()` orquestra context → signals → priorities → recommendations
- `pipeline.ts` — `runGrowthPipeline()` consolida engine + syncRecommendationsToActions + listActions + missão + planos + insights + automações + mudanças (evita duplicação entre rota e página)
- `context.ts` — `buildGrowthContext()` monta GrowthContext com dados REAIS do banco (perfil, métricas, metas, experimentos, alertas, planejamento)
- `errors.ts` — `toGrowthHttpError()` normaliza erros para HTTP
- `db.ts` — repository com delegate `ge.action` (mesma estratégia shim das fases anteriores)

### PARTE 3 — GrowthContext único + REGRA ABSOLUTA (não inventar)
- `GrowthContext` concentra: userProfile, estágio, Instagram + TikTok (PlatformContext), insights, perfil de inteligência, confidence, generatedAt
- `confidence` (0..1) **reduz automaticamente quando dados faltam**
- `PlatformContext.status` com `SEM_REDE | SEM_SYNC | POUCOS_DADOS | DADOS_SUFICIENTES` (Parte 23)
- Nenhuma métrica sintética é fabricada; TikTok sem reach/impressions → `null` (nunca 0 inventado)

### PARTE 4 — 15 sinais determinísticos
18 tipos de sinal implementados (`SignalType`), todos derivados de dados reais:

`LOW_POSTING_FREQUENCY`, `ENGAGEMENT_DROP`, `REACH_DROP`, `FOLLOWER_GROWTH_DROP`, `HIGH_PERFORMING_CONTENT`, `LOW_RETENTION`, `INCONSISTENT_POSTING`, `GOAL_ON_TRACK`, `GOAL_AT_RISK`, `GOAL_ACHIEVED`, `EXPERIMENT_RUNNING`, `EXPERIMENT_WINNER`, `EXPERIMENT_LOSER`, `EXPERIMENT_INCONCLUSIVE`, `CONTENT_GAP`, `PROFILE_OPTIMIZATION_NEEDED`, `NO_RECENT_DATA`, `NO_CONNECTED_ACCOUNT`

- Cada sinal tem: type, severity (INFO..CRITICAL), platform, evidência real, momento
- Plataformas normalizadas: Instagram e TikTok usam o mesmo contrato (Parte 20)

### PARTE 5 — Prioridades (máximo 3)
- `prioritizeSignals()` limita a **3 prioridades**, deduplica por tipo, ordena por score (impacto × urgência × confiança)
- Cada prioridade tem: level (1/2/3), título, evidência resumida, score, signalType, platform

### PARTE 6 — Recomendações acionáveis
- `buildRecommendations()` gera recomendações com campos acionáveis: `oQue`, `porQue`, `evidencia`, `como`, `quando`, `metrica`, `confianca`, `slug` único
- NUNCA recomenda métrica sem dado real (ex.: sem sincronização, recomenda "conectar" em vez de "aumentar seguidores")

### PARTE 7 — Plano de ação → GrowthAction (sem duplicar UserGoal/PlannedContent)
- `model GrowthAction` — persistência única nova (id, userId, platform, title, description, reason, priority, status, dueAt, completedAt, sourceSignal, sourceRecommendation, metricToWatch, baselineValue, resultValue, resultNote, xpGranted)
- `syncRecommendationsToActions()` cria ações PENDING a partir de recomendações atuais, **nunca duplicando** (dedup por sourceRecommendation + título)
- Reutiliza UserGoal/PlannedContent como ENTRADA do contexto — não os duplica

### PARTE 8 — Missão do Dia
- `pickDailyMission()` escolhe a ação de maior prioridade pendente como "missão do dia"
- Sem dados → racional explícito `DADO INSUFICIENTE` (nunca inventa tarefa)

### PARTE 9 — Plano de 7 dias
- `buildPlan7Days()` — 7 dias com foco + itens acionáveis, derivados de prioridades e recomendações
- Adapta-se ao estágio/plataforma; com dados insuficientes, vira checklist de conexão/sincronização

### PARTE 10 — Plano de 30 dias
- `buildPlan30Days()` — 4 semanas com tema + itens; primeira semana prioriza fundação quando não há dados

### PARTE 11 — Insights proativos automáticos
- `buildProactiveInsights()` — converte sinais em insights com `kind`: `DADO_REAL | INFERENCIA | RECOMENDACAO | DADO_INSUFICIENTE`
- `summarizeChanges()` — "O que mudou" (deduplicado, sem spam)

### PARTE 12 — Evoluir `/api/alertas` sem duplicar
- `GET /api/growth/alertas` — responde com:
  - `alerts`: alertas determinísticos clássicos (`generateAlerts`, Fase 4.5 — reutilizado)
  - `signals`: sinais do Growth Engine
  - `insights`: insights proativos
  - `changes`: resumo de mudanças
- Sem persistência nova; recálculo a cada GET (mesmo comportamento de `/api/alertas`)

### PARTE 13 — Evoluir Dashboard
- `DashboardGrowthOverview` (server component) exibe no Dashboard: **MISSÃO DO DIA, PRIORIDADES e SINAIS IMPORTANTES** + link "Ver motor completo" → `/growth`
- Adicionado ao `Promise.all` do Dashboard (sem aumentar latência perceptível)

### PARTE 14 — IA Acessor usa GrowthContext
- `src/lib/ai/services/chat.ts` agora injeta `growthContextToPrompt(gctx)` no system prompt
- Instrução explícita: quando dados ausentes (`SEM_REDE/SEM_SYNC/POUCOS_DADOS`), dizer **"DADO INSUFICIENTE"** e recomendar conectar/sincronizar
- `prompt.ts` serializa apenas campos reais; nunca fabrica números

### PARTE 15 — Knowledge Engine ≠ Growth Engine
- Não substitui nada: Knowledge Engine (Fase 4.5, 30 módulos oficiais) permanece intacto
- Growth Engine é a camada operacional; `buildKnowledgeContext` e `buildGrowthContext` coexistem no chat

### PARTE 16 — Score — evoluído apenas onde necessário
- Reutiliza `getLatestScore` (Fase 4.7) no contexto; nenhuma regressão no growth-score-v1

### PARTE 17 — GrowthAction integrado ao XP (idempotente)
- `completeActionWithXp()` conclui ação + concede XP via `grantXpAmount(userId, "concluir-acao-crescimento", id, 15)`
- Idempotência garantida por `XpLog @@unique(userId + source + refId)` — nunca concede 2x

### PARTE 18 — Integrar UserGoal (GOAL_ON_TRACK / GOAL_AT_RISK / GOAL_ACHIEVED)
- Sinais derivados de metas reais: prazo próximo + progresso baixo → `GOAL_AT_RISK`; progresso saudável → `GOAL_ON_TRACK`; 100% → `GOAL_ACHIEVED`
- Recomendações e prioridades correspondentes

### PARTE 19 — Integrar GrowthExperiment
- Sinais para `RUNNING`, `WINNER` (CONFIRMED), `LOSER`, `INCONCLUSIVE` + recomendações (replicar, parar, aguardar dados)

### PARTE 20 — Instagram E TikTok normalizados
- Mesmo `PlatformContext` para ambos; TikTok sem reach/impressions → `null`
- Sinais, prioridades e recomendações aceitam `platform: "instagram" | "tiktok"`

### PARTE 21 — Automações internas (NÃO DM real, NÃO publicar automático, NÃO responder comentários)
- `automations.ts` — `buildInternalAutomations()` gera automações internas (3 regras: `GOAL_AT_RISK_ALERTA`, `HIGH_PERFORMING_REPLICAR`, `INCONSISTENT_PLANEJAR`)
- Cada automação tem `output`: `alerta | recomendacao | acao` — **nunca** `dm`/`publicacao`/`comentario`
- `automationSafetyNotes()` documenta a política: NENHUMA ação externa real
- `InternalAutomation` exposto no pipeline e renderizado na página com aviso explícito

### PARTE 22 — UX elegibilidade Instagram (Business E Creator compatíveis)
- O motor trata contas conectadas com permissões reais do usuário; não inventa elegibilidade
- Fluxo de conexão existente (Fases 2-3) já suporta Business/Creator; o engine apenas consome dados sincronizados

### PARTE 23 — Estados sem dados
- `PlatformContext.status`: `SEM_REDE | SEM_SYNC | POUCOS_DADOS | DADOS_SUFICIENTES`
- Labels em PT-BR + impacto na `confidence` e nas recomendações (nunca métricas fictícias)

### PARTE 24 — Segurança
- Todas as rotas: `requireSession()` → `userId` **sempre session-derived**
- Owner-check em cada leitura/escrita (ex.: `record.userId !== userId → null`)
- Zod em todos os inputs (`src/lib/validators/growth.ts`)
- Rate-limit e padrões de segurança herdados das fases anteriores mantidos

### PARTE 25 — Performance
- Pipeline consolidado em `runGrowthPipeline` (uma chamada para tudo)
- `Promise.all` no Dashboard; `take`/limites em listagens
- Sinais/prioridades/recomendações são puros e O(1)/O(n) leves

### PARTE 26 — UX/DESIGN — identidade preservada
- Tokens existentes (bg `#F7F8FA`, ink `#111318`, purple `#8B5CF6`, magenta `#F43F8E`, border `#E5E7EB`)
- Componentes reutilizados (`Badge`, `Button`, `EmptyState`, `useToast`)
- Nenhum token novo, nenhuma quebra de layout

### PARTE 27 — NÃO FEITO (respeitado)
Nada além do escopo foi implementado:
- ❌ Sem DM real / publicação automática / resposta a comentários
- ❌ Sem integração Asaas operacional
- ❌ Sem alteração de planos/preços
- ❌ Sem alteração de identidade visual
- ❌ Sem `--accept-data-loss`
- ❌ Sem commit/push
- ❌ Fase 9 NÃO iniciada

### PARTE 28 — Testes determinísticos sem APIs externas
`scripts/growth-engine-tests.ts` + `tsconfig.growth-test.json` (CommonJS standalone, Node `assert`):

**23/23 testes passando** cobrindo:
- detecção de sinais (NO_CONNECTED_ACCOUNT, ENGAGEMENT_DROP, LOW_POSTING_FREQUENCY)
- priorização (≤ 3, sem duplicar tipo, ordenada)
- recomendações acionáveis (oQue/porQue/como/metrica/confianca)
- DADO INSUFICIENTE sem dados (recomendações de conexão, nunca métricas inventadas)
- GOAL_AT_RISK / GOAL_ON_TRACK
- experimentos WINNER/LOSER/RUNNING
- CONTENT_GAP
- insights proativos com origem real
- plano 7 dias (7 dias, cada um ≥ 1 item)
- plano 30 dias (4 semanas, adapta ao estágio)
- missão do dia DADO INSUFICIENTE
- automações internas (nunca dm/publicacao)
- slugs únicos (dedup de ações)
- idempotência de XP (nunca concluir mesma ação 2x)

Para rodar: `npm run growth:test` (adicionado ao package.json)

### PARTE 29 — Validação final (honesta sobre bloqueios)
| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ **EXIT 0** (gate autoritativo de código) |
| `npm run growth:test` | ✅ **23/23 testes passaram** |
| `git diff --stat` / `git status` | ✅ Confirma apenas alterações Fase 8 + fases anteriores pendentes |
| `prisma format/validate/generate` | ⚠️ **BLOQUEADO no sandbox** — `binaries.prisma.sh` → 403 Forbidden (rede bloqueada). Schema verificado manualmente: sintaxe intacta, `GrowthAction` presente |
| `npm run build` | ⚠️ **BLOQUEADO no sandbox** — SWC binary ausente (`@next/swc-linux-x64-gnu` não instalado) + `npm install` → 403 Forbidden |
| `prisma db push` | ⚠️ **BLOQUEADO** (mesmo 403) — DONA precisa rodar localmente |

**Registrado honestamente:** o sandbox bloqueia downloads dos engines Prisma e do binário SWC via 403. Nenhum resultado foi "fingido"; a validação local completa deve ser feita pela DONA.

### PARTE 30 — RELATORIO-FASE8.md (este arquivo)
Concluído com todas as 30 partes documentadas.

---

## 4. Arquivos da Fase 8

### Novos (Growth Engine)
```
src/lib/growth-engine/
  actions.ts          # CRUD + conclusão com XP idempotente + sync de recomendações
  automations.ts      # automações internas (alerta/recomendação/ação — nunca externo)
  context.ts          # buildGrowthContext — dados REAIS, confidence, DataStatus
  db.ts               # repository (delegate ge.action + shim)
  engine.ts           # runGrowthEngine (context→signals→priorities→recommendations)
  errors.ts           # toGrowthHttpError
  index.ts            # barrel
  insights.ts         # buildProactiveInsights + summarizeChanges
  pipeline.ts         # runGrowthPipeline (consolida tudo)
  priorities.ts       # prioritizeSignals (máx 3) + SIGNAL_LABELS
  progress.ts         # pickDailyMission + buildPlan7Days + buildPlan30Days
  prompt.ts           # growthContextToPrompt (p/ IA, sem inventar)
  recommendations.ts  # buildRecommendations (acionáveis)
  signals.ts          # detectSignals (18 tipos) + platformLabel
  types.ts            # GrowthContext, PlatformContext, SignalType, etc.

src/app/api/growth/
  engine/route.ts     # GET — pipeline completo
  actions/route.ts    # GET/POST/PATCH/DELETE
  alertas/route.ts    # GET — alertas inteligentes (evolui /api/alertas)

src/app/(app)/growth/page.tsx       # página Automações Inteligentes
src/components/growth/
  growth-engine-client.tsx          # cliente da página (Missão, Prioridades, Sinais, etc.)
  dashboard-growth-overview.tsx     # visão no Dashboard (Parte 13)

src/lib/validators/growth.ts        # Zod (segurança)
src/types/prisma-shim.d.ts          # interface GrowthAction (Fase 8)
scripts/growth-engine-tests.ts      # 23 testes determinísticos
tsconfig.growth-test.json           # config standalone de testes
```

### Editados (integração)
- `src/app/(app)/dashboard/page.tsx` — adiciona `DashboardGrowthOverview`
- `src/lib/ai/services/chat.ts` — injeta GrowthContext + DADO INSUFICIENTE
- `src/lib/navigation.ts` — item "Automações Inteligentes" → `/growth`
- `prisma/schema.prisma` — adiciona `model GrowthAction` + relações
- `package.json` — script `growth:test`
- `.gitignore` — ignora `.growth-test-build`

---

## 5. Depende de configuração externa
- **Instagram/TikTok reais**: sinais e recomendações só têm valor após conectar + sincronizar (Fases 2-3). Sem isso → `SEM_REDE/SEM_SYNC` → `DADO INSUFICIENTE`.
- **Meta/TikTok App Review**: publicação real permanece `INTEGRATION_NOT_CONFIGURED` (Fase 7). O Growth Engine não publica nem envia DM.
- **Chaves IA (OpenAI/Gemini)**: necessárias para IA Acessor com contexto de crescimento.

---

## 6. Precisa validação local da DONA
1. `npx prisma generate` (gera client com `GrowthAction`)
2. `npx prisma db push` (aplica `GrowthAction` no Neon — SEM `--accept-data-loss`)
3. `npm run build` (SWC disponível localmente)
4. Testar: conectar Instagram/TikTok → sincronizar → abrir `/growth` e Dashboard
5. Confirmar Missão do Dia, Prioridades, Sinais, Recomendações, Ações (concluir → +15 XP)
6. `npm run growth:test` (23 testes)
7. Se OK: commit + push (padrão das fases anteriores)

---

## 7. Próximo passo
**Fase 8 encerrada. Aguardando validação local da DONA. Fase 9 NÃO iniciada.**
