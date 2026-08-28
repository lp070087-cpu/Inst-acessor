# RELATÓRIO — FASE 5 · RANK, XP, METAS, CONQUISTAS E PROGRESSÃO

> **Status: CONCLUÍDA** (aguardando validação local da DONA)
> Data: **2026-08-27** · Sandbox: sem rede para SWC/`prisma generate` (limitações conhecidas, iguais às fases anteriores)

---

## 1. RESUMO EXECUTIVO

A Fase 5 entregou o sistema de **progressão do usuário** do Inst Acessor, ligado **exclusivamente a ações reais** do aplicativo — nada de gamificação vazia. O usuário ganha XP ao produzir conteúdo (copy, ideias, rascunhos), executar recomendações da Mentoria, completar experimentos, rodar análises, calcular o Score, sincronizar Instagram/TikTok, concluir metas estratégicas, concluir o onboarding e desbloquear conquistas.

**Princípios respeitados (Knowledge Engine — Módulo 28):**

- XP **~5–100** conforme a dificuldade da ação, com valores **versionáveis** por fonte.
- **Idempotência real**: a MESMA ação nunca concede XP duas vezes (chave única `userId + source + refId` em `XpLog` + verificação `findUnique` antes de criar).
- Conquistas ligadas a comportamentos que contribuem para **crescimento** (consistência, executar recomendações, testar conteúdos, acompanhar resultados, completar experimentos, planejar, analisar desempenho, melhorar o perfil, cumprir metas estratégicas).
- Ao atingir **~70% das conquistas** de um conjunto, **desafios mais difíceis** (ocultos) entram em cena.
- Nenhuma métrica inventada: todo progresso vem de **DADOS REAIS** persistidos no Neon (contagens de tabelas existentes e snapshots reais), diferenciando sempre **DADO REAL → INFERÊNCIA → RECOMENDAÇÃO**.
- Nada de Meta/TikTok real, nada de integração externa nova, identidade visual intacta.

**Entregues:** 7 arquivos em `src/lib/gamification/`, 4 novas APIs em `src/app/api/rank/`, página `/rank` funcional (substituiu placeholder), integração de XP em **12 ações reais** do app, 5 models Prisma novos + relações no `User` + shim de tipos.

---

## 2. AUDITORIA PRÉVIA DA ARQUITETURA (evitar duplicação)

Antes de codificar, foi auditado o que já existia (Fases 1–4.5) para **reutilizar** em vez de duplicar:

| Já existia | Como a Fase 5 reutilizou |
| --- | --- |
| `requireSession()` / `requireOnboardedSession()` (`src/lib/auth/guard.ts`) | Proteção de TODAS as novas APIs e da página `/rank` |
| Prisma singleton (`src/lib/db`) | Leituras reais das tabelas existentes (GeneratedCopy, ContentIdea, SocialDraft, MentorshipRecommendation, GrowthExperiment, ProfileScoreSnapshot, InstagramSnapshot, TikTokSnapshot, AIProfile) |
| Dashboard Instagram/TikTok (`src/lib/dashboard/*`) | `recomputeGoalProgress` usa `getDashboardInstagramData` / `getTikTokDashboardData` (dados reais) para medir metas |
| Funções de IA existentes (copy, ideias, mentoria, score, onboarding, sync) | Pontos de disparo de XP — **nenhuma lógica de gamificação duplicada**, apenas chamadas após o sucesso da ação |
| Padrão `src/types/prisma-shim.d.ts` (module augmentation) | Estendido com os 5 novos models da Fase 5 (o sandbox não roda `prisma generate`) |

Nenhuma API, model ou componente foi duplicado.

---

## 3. MODELS CRIADOS / ALTERADOS (Prisma)

Arquivo: `prisma/schema.prisma` (+120 linhas) · Shim: `src/types/prisma-shim.d.ts` (+68 linhas)

### Criados (5 models)

| Model | Papel | Chaves/índices |
| --- | --- | --- |
| `UserLevel` | Estado de progressão 1:1 por usuário (XP total, nível, `totalXpEarned` agregado para auditoria, `lastLevelUpAt`) | `userId` **unique**; índices `[level]`, `[xp]` |
| `XpLog` | **Auditoria** de TODA concessão de XP (source, refId, amount, createdAt) | `@@unique([userId, source, refId])` — **anti-duplicidade**; índices `[userId, createdAt]`, `[source, refId]` |
| `UserGoal` | Meta estratégica do usuário (categoria, título, targetValue, currentValue, unidade, plataforma, status, deadline) | Índices `[userId, status]`, `[userId, category]` |
| `Achievement` | Catálogo **global** de conquistas (slug único, título, descrição, categoria, xpReward 5–100, threshold, tier, hidden, version, active) | `slug` **unique**; índices `[category]`, `[active]` |
| `UserAchievement` | Conquista **por usuário** — progresso individual, bloqueio/desbloqueio, histórico (`unlockedAt`), se o XP já foi concedido | `@@unique([userId, achievementId])`; índices `[userId, unlocked]`, `[achievementId]` |

### Alterado (1 model)

`User` — adicionadas 4 relações: `userLevel UserLevel?`, `xpLogs XpLog[]`, `userGoals UserGoal[]`, `userAchievements UserAchievement[]`. Todas com `onDelete: Cascade`.

### Consequência

Há **alteração de schema** → a DONA precisa rodar `prisma db push` localmente (comandos exatos na seção 9).

---

## 4. MOTORES DE NEGÓCIO (src/lib/gamification/ — 7 arquivos)

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | Acesso aos delegates dos 5 novos models via padrão `gp` (mesmo do Knowledge Engine) — sem `any` |
| `xp.ts` | Motor de XP: tabela `XP_VALUES` (fonte → valor), curva de nível (`100 + (level-1)*25`), `levelInfoFromXp`, `grantXp`/`grantXpAmount` **idempotentes**, `stableRefId` (hash determinístico para ações sem id persistido), `getUserProgress` |
| `achievements.ts` | Catálogo oficial de **15 conquistas** (seed idempotente por slug) — fonte de verdade |
| `progress.ts` | `computeProgress` (15 `ProgressKind` lendo tabelas reais), `seedAchievements`, `getUserAchievements`, `checkAndUnlockAchievements` (desbloqueia + concede XP UMA vez) |
| `goals.ts` | Motor de metas: CRUD + `recomputeGoalProgress` (mede com dados reais do dashboard, conclui metas atingidas e concede 35 XP UMA vez por meta) |
| `ranking.ts` | Ranking global por XP, posição do usuário, total de usuários e histórico de evolução (pontos cumulativos reais do XpLog) |
| `index.ts` | Barrel oficial de exports |

### Catálogo de conquistas (15)

**Uso (XP baixo):** Primeira Copy (10), Primeira Ideia (10), Primeiro Rascunho (10), Analista em Ação (10)
**Consistência:** Primeira Semana Ativa (20), Frequência Consistente (25), Olho no Instagram (30), Olho no TikTok (30)
**Estratégia:** Recomendação Executada (40), Cientista do Crescimento (50), Perfil Afiado (15), Meta Batida (35)
**Desafios ocultos (entram ~70%):** Nível 5 (60), Mestre do XP / 1000 XP (80), Colecionador / 10 conquistas (100)

---

## 5. APIS CRIADAS (todas protegidas por sessão)

| API | Métodos | Papel | Owner-check |
| --- | --- | --- | --- |
| `/api/rank` | GET | Dados consolidados da página `/rank`: progresso (nível/XP), xpLogs, ranking + posição, evolução, conquistas, metas (com recálculo) | Sim (só userId da sessão) |
| `/api/rank/acoes` | GET | Histórico/auditoria das concessões de XP + catálogo de fontes | Sim |
| `/api/rank/metas` | GET, POST, PATCH, DELETE | CRUD de metas + recálculo de progresso real | Sim (PATCH/DELETE verificam dono) |
| `/api/rank/conquistas` | GET, POST | Lista conquistas (com `?visiveis=1`) + dispara `checkAndUnlockAchievements` | Sim |

Todas usam `requireSession()`; nenhuma expõe dados de outro usuário.

---

## 6. COMO O XP É CONCEDIDO (12 integrações com ações reais)

| Ação real (arquivo) | Fonte de XP | XP | refId (idempotência) |
| --- | --- | --- | --- |
| Salvar copy (`api/copy`) | `salvar-copy` | 10 | id do copy persistido |
| Gerar copy (`api/ai/generate-copy`) | `gerar-copy` | 5 | `stableRefId(plataforma:formato:objetivo:conteúdo)` |
| Salvar ideia (`api/ideas`) | `salvar-ideia` | 10 | id da ideia persistida |
| Gerar ideia (`api/ai/generate-ideas`) | `gerar-ideia` | 5 | `stableRefId(ideias:categoria:títulos)` |
| Criar rascunho (`api/drafts`) | `criar-rascunho` | 10 | id do rascunho persistido |
| Rodar análise (`api/analise`) | `analisar-desempenho` | 10 | `stableRefId(analise:plataforma:periodo:data)` (1×/dia) |
| Calcular Score (`api/score`) | `calcular-score` | 15 | id do ProfileScore persistido |
| Executar recomendação (`api/mentoria` PATCH) | `executar-recomendacao` | 40 | id da recomendação |
| Completar experimento (`api/experimentos` PATCH) | `completar-experimento` | 50 | id do experimento |
| Concluir meta (`goals.recomputeGoalProgress`) | `concluir-meta` | 35 | id da meta |
| Sincronizar Instagram (`api/integrations/instagram/sync`) | `sincronizar-instagram` | 15 | id do snapshot criado |
| Sincronizar TikTok (`api/integrations/tiktok/sync`) | `sincronizar-tiktok` | 15 | id do snapshot criado |
| Concluir onboarding (`api/onboarding`) | `concluir-onboarding` | 20 | userId |
| Desbloquear conquista (`checkAndUnlockAchievements`) | `conquista-desbloqueada` | **5–100** (xpReward real da conquista) | slug da conquista |

Após cada concessão, quando relevante, é chamado `checkAndUnlockAchievements(userId)` para avaliar desbloqueios.

### Como evita XP duplicado

1. **Banco**: `XpLog` tem `@@unique([userId, source, refId])` — a mesma combinação só pode existir uma vez.
2. **Código**: `grantXpAmount` faz `findUnique` antes de `create` (retorna `alreadyGranted: true` sem conceder de novo).
3. **Ações sem id persistido**: `stableRefId` (hash djb2 determinístico do conteúdo) garante que o MESMO conteúdo gere o MESMO refId — gerar a mesma copy duas vezes não rende XP duas vezes.
4. **Conquistas**: a coluna `xpGranted` + a chave `conquista-desbloqueada/slug` impedem XP duplo no mesmo badge.
5. **Metas**: `concluir-meta/id-da-meta` é idempotente — a meta concluída não concede de novo.

---

## 7. COMO METAS E CONQUISTAS SÃO CALCULADAS

### Metas (UserGoal)

- Categorias: `crescimento`, `engajamento`, `consistencia` · Status: `ATIVA`, `CONCLUIDA`, `CANCELADA`.
- `recomputeGoalProgress(userId)` lê o **valor real** por categoria/plataforma das funções de dashboard existentes:
  - **crescimento** → `followersCount` · **engajamento** → engagement/likes · **consistência** → `snapshotCount`.
- Se `real >= targetValue`, a meta é marcada `CONCLUIDA` (com `currentValue = targetValue`) e concede **35 XP uma vez**.
- Nenhum progresso é digitado à mão: tudo vem de snapshots reais.

### Conquistas (Achievement / UserAchievement)

- O catálogo define o **threshold** (ex.: 1 copy, 7 dias, 3 dias na semana, 5 sincronizações, 1000 XP) e a unidade.
- `computeProgress(userId, kind)` mede o progresso atual **direto nas tabelas reais** (contagens com `userId`, snapshots por semana, nível/XP em `UserLevel`, metas concluídas, conquistas desbloqueadas).
- `checkAndUnlockAchievements` percorre as conquistas; quando `progress >= threshold`, marca `unlocked: true` + `unlockedAt`, seta `xpGranted: true` e concede o `xpReward` **uma vez**.
- A página mostra **progresso individual de cada conquista**, bloqueadas vs. desbloqueadas, e **histórico** (`unlockedAt`).

---

## 8. PÁGINA /rank (substituiu o placeholder)

- **`src/app/(app)/rank/page.tsx`** (server component): `requireOnboardedSession()` → carrega em paralelo progresso, ranking, evolução, conquistas e metas → renderiza `<RankClient initial={...} />`.
- **`src/components/gamification/rank-client.tsx`** (client): **5 abas** — Visão Geral (evolução em SVG nativo + cards de nível/XP), Ranking (pódio + lista), Metas (ativas/concluídas/canceladas, criar/editar/cancelar, progresso real), Conquistas (grade com tiers BRONZE/PRATA/OURO/DESAFIO, cadeado para bloqueadas, progresso individual) e Histórico (auditoria de XP com rótulo por fonte).
- Mantém **exatamente a identidade visual aprovada**: fundo gelo/branco, `surface`, `ink`, magenta `#F43F8E`, roxo `#8B5CF6`, gradientes `brand-grad`, bordas `#E5E7EB`, sombras dos cards, componentes `Button/Tabs/ProgressBar/EmptyState`.

---

## 9. COMO A FASE 5 CONVERSA COM O KNOWLEDGE ENGINE (Fase 4.5)

| Módulo/regra do Knowledge Engine | Implementação na Fase 5 |
| --- | --- |
| **Módulo 28 (Gamificação)** — XP ~5–100 conforme dificuldade | `XP_VALUES` (5–100) + `xpReward` das conquistas (10–100), ambos **versionáveis** |
| Módulo 28 — ao atingir **~70%** das conquistas, entram desafios mais difíceis | 3 conquistas `DESAFIO` com `hidden: true` (Nível 5, 1000 XP, 10 conquistas); a UI filtra `?visiveis=1` até o momento certo |
| Sem gamificação vazia → recompensar comportamentos de crescimento | Conquistas e fontes de XP cobrem: produzir conteúdo, **executar recomendações da Mentoria**, **completar experimentos**, **acompanhar resultados** (análise/score/snapshots), **consistência** (dias ativos, frequência semanal), **planejar** (metas) e melhorar perfil |
| Não inventar métricas / DADO REAL → INFERÊNCIA → RECOMENDAÇÃO | Todo progresso é **contagem real** de tabelas existentes; nada de mock; metas usam dados do dashboard |
| Regras de experimentos (ENOUGH_DATA, CONFIRMED/REJECTED) | XP só ao completar experimento com status CONFIRMED/REJECTED — alinhado à metodologia oficial |

---

## 10. VALIDAÇÕES

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ **EXIT 0** — limpo |
| `npm run build` | ⚠️ Falha conhecida do sandbox: `Failed to load SWC binary for linux/x64` (sem rede para baixar `@next/swc-linux-x64-gnu`). **Mesma limitação das fases anteriores, não é regressão** — a DONA roda o build local |
| `git status --short` | ✅ 15 arquivos modificados + 3 diretórios novos (rank API, gamification lib, gamification components) |
| `git diff --stat` | ✅ 15 arquivos, +362 / −8 |

---

## 11. ARQUIVOS CRIADOS / ALTERADOS

**Criados (novos):**
- `src/lib/gamification/` → `db.ts`, `xp.ts`, `achievements.ts`, `progress.ts`, `goals.ts`, `ranking.ts`, `index.ts`
- `src/app/api/rank/` → `route.ts`, `acoes/route.ts`, `metas/route.ts`, `conquistas/route.ts`
- `src/components/gamification/rank-client.tsx`
- `prisma/seed-achievements.ts` (seed idempotente do catálogo de conquistas)

**Alterados:**
- `prisma/schema.prisma` (5 models + 4 relações no `User`)
- `src/types/prisma-shim.d.ts` (5 interfaces de tipos)
- `src/app/(app)/rank/page.tsx` (placeholder → página real)
- `src/lib/gamification/xp.ts` (adicionado `stableRefId` e fonte `conquista-desbloqueada`)
- `src/lib/gamification/goals.ts` (tipos de `updateGoal` aceitando `null`)
- `src/lib/gamification/index.ts` (novos exports)
- 12 rotas de ação integradas com XP: `api/copy`, `api/ideas`, `api/drafts`, `api/ai/generate-copy`, `api/ai/generate-ideas`, `api/analise`, `api/score`, `api/mentoria`, `api/experimentos`, `api/integrations/instagram/sync`, `api/integrations/tiktok/sync`, `api/onboarding`

---

## 12. COMANDOS QUE A DONA PRECISA RODAR LOCALMENTE

**Há alteração no Prisma (schema).** Na raiz do projeto:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma db push
```

**Seed do catálogo de conquistas (opcional — cria os 15 badges globais):**

```bash
npx tsx prisma/seed-achievements.ts
```

> Arquivo criado em `prisma/seed-achievements.ts` (mesmo padrão do `seed-knowledge.ts`, idempotente por `slug`).
> Se preferir, o sistema **se auto-cria** as linhas `Achievement` via `ensureUserAchievements` no primeiro acesso à página `/rank` (upsert idempotente por slug). O seed é a forma de popular o catálogo global antecipadamente.

**Build e commit (após validar):**

```bash
npm run build
```

> A DONA autoriza commit/push localmente (o sandbox não tem permissão de rede/push — 403 nas fases anteriores).

---

## 13. PENDÊNCIAS

1. **Nenhuma pendência de código** — Fase 5 implementada e `tsc` limpo.
2. **Build não verificado localmente** pela DONA (sandbox não baixa o SWC binary).
3. **Banco** — `prisma db push` ainda NÃO executado (a DONA roda localmente); o seed de conquistas é opcional.
4. **Nenhum commit/push** feito (aguardando autorização, conforme regra).
5. **Fase 6 NÃO iniciada** — aguardando validação desta Fase 5.

---

## 14. CONCLUSÃO

A Fase 5 está **100% implementada, auditada e typechecked**. A gamificação é **ancorada em dados reais**, **idempotente** (nunca concede XP duplicado), **conversa com o Knowledge Engine** (Módulo 28) e **não altera a identidade visual**. A página `/rank` substituiu o placeholder por uma interface funcional completa. Resta apenas a DONA rodar `prisma db push` (+ build/commit/push) localmente e validar.
