# RELATÓRIO — FASE 6 · PLANEJAMENTO, CALENDÁRIO E PIPELINE DE CONTEÚDO

> **Status: CONCLUÍDA** (aguardando validação local da DONA)
> Data: **2026-08-27** · Sandbox: sem rede para SWC/`prisma generate` (limitações conhecidas, iguais às fases anteriores)

---

## 1. RESUMO EXECUTIVO

A Fase 6 entregou o **motor de planejamento, calendário e pipeline de conteúdo** do Inst Acessor. O usuário pode **planejar conteúdos reais** (plataforma, formato, título, tema, objetivo, data/horário, status, observações, hipótese), acompanhar cada conteúdo pelo **pipeline** (`IDEIA → EM_PRODUCAO → PRONTO → AGENDADO → PUBLICADO` + `RASCUNHO/CANCELADO/FALHOU`), visualizar em **mês / semana / lista**, receber um **plano semanal assistido por IA** (baseado apenas em contexto real) e associar cada conteúdo a **ideias, copies (com versionamento), previews sociais, experimentos e metas da Fase 5**.

**Princípios respeitados (ESCOPO-OFICIAL + Knowledge Engine — Módulo 25):**

- **Nada é publicado automaticamente.** "PUBLICADO" só poderá ser marcado com **confirmação real futura** da plataforma (via adapter), nunca pelo usuário/UI; o sistema diferencia **"agendado internamente"** (campo `scheduledAt`) de **"publicado pela plataforma"** (`publishedAt` + `externalId`, sempre nulos nesta fase).
- **Nada inventado.** O plano semanal usa **contexto real** (perfil, conexões, snapshots, AIProfile, metas, experimentos, conteúdo já planejado); quando o contexto é insuficiente, a UI mostra **DADO INSUFICIENTE** — nunca inventa frequência, horários ou "melhores momentos".
- **Copies nunca são sobrescritas silenciosamente**: toda edição vira **nova versão** (`ContentCopyVersion`).
- **XP só por ações reais** e **idempotente** (`planejar-conteudo` = 10 XP, chave única `userId + source + refId` — nunca concede duplicado).
- **Nenhuma integração externa nova**: as pastas `src/lib/publishing/` são **arquitetura apenas** (adapter genérico), sempre respondendo `ok: false`; NADA de Meta/TikTok real, NADA de automação de comentários.
- **Identidade visual intocada** (mesma paleta, cards, tipografia, botões, responsividade e transições aprovadas).

**Entregues:** 3 models Prisma novos + relações no `User`, 6 arquivos em `src/lib/planning/`, 7 rotas de API em `src/app/api/calendar/`, página `/calendario` funcional (substituiu o placeholder), componente cliente `calendar-client.tsx`, arquitetura de publicação (`src/lib/publishing/`), integração de XP `planejar-conteudo`, deep-link **Ideias → Planejar no calendário**, e versões de copy.

---

## 2. AUDITORIA PRÉVIA DA ARQUITETURA (evitar duplicação)

Antes de codificar, foi auditado o que já existia (Fases 1–5) para **reutilizar** em vez de duplicar:

| Já existia | Como a Fase 6 reutilizou |
| --- | --- |
| `requireSession()` / `requireOnboardedSession()` (`src/lib/auth/guard.ts`) | Proteção da página `/calendario` e de TODAS as novas APIs |
| Prisma singleton (`src/lib/db`) | Leituras reais de `ContentIdea`, `GeneratedCopy`, `SocialDraft`, `UserGoal`, `GrowthExperiment` para associações |
| `src/lib/knowledge/repository.ts` (`kb`) | Leitura real de experimentos (`kb.experiment`) e contexto do Knowledge Engine |
| `src/lib/gamification/*` (Fase 5) | `gp.goal` para associar metas; `grantXp`/`checkAndUnlockAchievements` para XP real e idempotente ao planejar |
| `src/lib/ai/services.ts` (Fase 4) | `listIdeas`, `listCopies`, `listDrafts`, `getAIProfile` para carregar entidades associáveis e contexto do plano semanal |
| `src/lib/ai/context.ts` + `src/lib/knowledge/context-builder.ts` | Contexto real para o plano semanal assistido |
| Padrão `src/types/prisma-shim.d.ts` (module augmentation) | Estendido com os 3 novos models da Fase 6 (o sandbox não roda `prisma generate`) |
| Design system (`Button`, `Tabs`, `Modal`, `Badge`, `EmptyState`, `useToast`, tokens Tailwind) | Toda a UI do calendário usa os componentes e tokens já aprovados |

Nenhuma API, model ou componente foi duplicado.

---

## 3. MODELS CRIADOS / ALTERADOS (Prisma)

Arquivo: `prisma/schema.prisma` (+216 linhas na Fase 6) · Shim: `src/types/prisma-shim.d.ts` (+110 linhas)

### Criados (3 models)

| Model | Papel | Chaves/índices |
| --- | --- | --- |
| `PlannedContent` | **Conteúdo planejado** no calendário (plataforma, formato, título, tema, objetivo, status do pipeline, `scheduledAt` interno, `publishedAt`/`externalId` reservados para confirmação real futura, notas, hipótese, associações idea/copy/draft/goal) | Índices `[userId, status]`, `[userId, scheduledAt]`, `[userId, platform]`, `[ideaId]`, `[copyId]`, `[goalId]` |
| `PlannedContentExperiment` | Associação **N:N** entre conteúdo planejado e experimentos da Fase 4.5 (um conteúdo pode testar várias hipóteses) | `@@unique([contentId, experimentId])` — **anti-duplicidade**; índice `[experimentId]`; `onDelete: Cascade` |
| `ContentCopyVersion` | **Versionamento simples** da copy vinculada a um conteúdo — nunca sobrescreve silenciosamente | `@@unique([contentId, version])`; índice `[userId, contentId]`; `onDelete: Cascade` |

### Alterado (1 model)

`User` — adicionadas 2 relações: `plannedContents PlannedContent[]`, `contentCopyVersions ContentCopyVersion[]`. Ambas com `onDelete: Cascade`.

### Relações de associação reutilizadas (sem alteração)

`PlannedContent.idea → ContentIdea` (SetNull), `.copy → GeneratedCopy` (SetNull), `.draft → SocialDraft` (SetNull), `.goal → UserGoal` (SetNull). Todas apontam para models já existentes — nenhum model anterior foi modificado além do `User`.

### Regras de status (pipelines)

- Pipeline principal: **IDEIA → EM_PRODUCAO → PRONTO → AGENDADO → PUBLICADO**.
- Estados auxiliares: **RASCUNHO** (padrão de criação sem data), **CANCELADO**, **FALHOU**.
- **`PUBLICADO` NUNCA é marcado por esta fase**: `publishedAt`/`externalId` ficam `null`; só um adapter real futuro (com confirmação da plataforma) poderá preenchê-los.

---

## 4. MOTORES DE NEGÓCIO (src/lib/planning/ — 6 arquivos)

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | Delegate `pl` (`content`, `contentExperiment`, `copyVersion`) via cast — mesmo padrão das fases anteriores (`ai`, `kb`, `gp`) |
| `content.ts` | CRUD de conteúdo planejado (listar com filtros, criar, atualizar, excluir, duplicar) — **todo owner-checked**; ao associar ideia marca a ideia como `PRODUZIDA`; ao associar copy cria **versão 1** automaticamente |
| `calendar.ts` | `buildCalendarView` (mês/semana), `computePipelineCounts` (cards clicáveis do pipeline), associação/desassociação de experimentos (idempotente via `@@unique`) |
| `copy-versions.ts` | Listar/adicionar/reverter versões de copy (auto-incremento; **nunca sobrescreve** — "restaurar" cria versão nova) |
| `weekly-plan.ts` | `buildWeeklyPlan` (contexto real, `DADO INSUFICIENTE` quando faltar) e `generateWeeklyPlanWithAI` (IA se configurada; fallback determinístico) |
| `index.ts` | Barrel público do motor |

---

## 5. APIS CRIADAS (todas session-required + owner-checked + Zod)

| Rota | Métodos | Função |
| --- | --- | --- |
| `/api/calendar` | GET / POST / PATCH / DELETE | Lista com filtros (plataforma, formato, status, objetivo, experimento, meta, período) · cria (XP `planejar-conteudo`) · atualiza/reagenda · exclui |
| `/api/calendar/detail` | GET | Detalhe completo de um conteúdo |
| `/api/calendar/duplicate` | POST | Duplica um conteúdo (status `RASCUNHO`, sem data) |
| `/api/calendar/experiments` | POST / DELETE | Associa/desassocia experimento ao conteúdo |
| `/api/calendar/copy-versions` | GET / POST | Lista versões de copy · adiciona nova versão |
| `/api/calendar/copy-versions/restore` | POST | Restaura versão anterior (criando versão nova) |
| `/api/calendar/weekly-plan` | GET | Plano semanal (determinístico ou `?mode=ai`) |

Validações Zod em `src/lib/validators/planning.ts` (`createPlannedContentSchema`, `updatePlannedContentSchema`, `attachExperimentSchema`, `addCopyVersionSchema`, `calendarFiltersSchema`) e reexportadas em `src/lib/validators/index.ts`. O `userId` da sessão é sempre a fonte de verdade (nunca confiado no client) e toda escrita passa por owner-check (`findUnique` → compara `userId`).

---

## 6. PÁGINA /calendario (substituiu o placeholder)

- **Servidor** (`src/app/(app)/calendario/page.tsx`): `requireOnboardedSession()`, carrega conteúdos, plano semanal, ideias, copies, drafts, experimentos e metas via `Promise.all`.
- **Cliente** (`src/components/planning/calendar-client.tsx`): 
  - Cards do pipeline clicáveis (filtram por status) + contagem real.
  - Tabs **Mês / Semana / Lista** + âncoras (navegação, "Hoje").
  - **Filtros**: plataforma, formato, status, objetivo, experimento, meta e período.
  - **Ações**: criar, editar, reagendar, duplicar, cancelar, excluir, abrir preview, associar ideia/copy/experimento/meta.
  - Modal de criação com **deep-link** `?planejar=<ideaId>` (preenche título/objetivo/plataforma/formato a partir da ideia e limpa a URL).
  - Modal de detalhe com abas **Detalhes / Copy / Preview** (versões de copy com salvar/restaurar; preview social editável — caption/hashtags/tipo — via `/api/drafts`, nunca publica).
  - `WeeklyPlanCard` com badges de contexto real e botão "Plano com IA"; se faltar contexto, mostra **DADO INSUFICIENTE**; racional em `<details>` para transparência.

---

## 7. INTEGRAÇÕES (Fase 6.4–6.10)

| Integração | Como |
| --- | --- |
| **Ideias (Fase 4)** | Botão "Planejar no calendário" em `src/components/ai/ideas-client.tsx` → `/calendario?planejar=<id>` → modal pré-preenchido preservando a justificativa; ao salvar, a ideia vira `PRODUZIDA` |
| **Copy (Fase 4)** | Associação `copyId` + **versionamento** (`ContentCopyVersion`): versão 1 criada ao anexar; edições viram versões novas; reverter cria versão nova — **nunca sobrescreve** |
| **Preview Social (Fase 4)** | Aba Preview no detalhe: abre o draft, permite editar e salvar, volta ao planejamento — **nunca publica** |
| **Knowledge Engine (Fase 4.5)** | Plano semanal usa `buildKnowledgeContext` + contexto do perfil; regras do Módulo 25 aplicadas nos estados/observações |
| **Experimentos (Fase 4.5)** | Associação **N:N** `PlannedContentExperiment` (preparação apenas — nenhum resultado inventado); filtro por experimento |
| **Metas (Fase 5)** | Associação `goalId → UserGoal`; metas ativas alimentam o plano semanal |
| **XP (Fase 5)** | `planejar-conteudo` = 10 XP ao criar/duplicar conteúdo — idempotente (XpLog `@@unique([userId, source, refId])`), sem XP vazio |

---

## 8. PREPARAÇÃO ARQUITETURAL PARA PUBLICAÇÃO FUTURA (Fase 6.14)

`src/lib/publishing/` — **arquitetura apenas, NENHUMA chamada real**:

- `index.ts`: contrato genérico — `PublishPayload`, `PublishResult`, `PUBLISH_PLATFORMS`, `getPublisher(platform)`.
- `instagram/index.ts`: `prepareInstagramPublish` — **sempre** `{ ok: false, reason: "Publicação real não está disponível nesta fase..." }`.
- `tiktok/index.ts`: `prepareTikTokPublish` — **sempre** `{ ok: false, ... }`.

Isso cumpre 6.14 (preparar a estrutura para futuros adapters) sem violar 6.15 (nada de Meta/TikTok real, nada de webhook externo).

---

## 9. NAVEGAÇÃO E VISUAL

- `src/lib/navigation.ts`: item **"Calendário"** (`CalendarDays`, href `/calendario`) adicionado após Rank.
- Visual: mesmos tokens (fundo `#F7F8FA`, surface `#F1F3F5`, ink, magenta `#F43F8E`, roxo `#8B5CF6`), componentes (`Button`, `Tabs`, `Modal`, `Badge`, `EmptyState`, `Toast`) e padrões responsivos já aprovados. **Nenhuma alteração na identidade visual.**

---

## 10. VALIDAÇÕES

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ **EXIT 0** (typecheck limpo) |
| `npm run build` | ⚠️ Falha conhecida: `@next/swc-linux-x64-gnu` não instalado no sandbox (sem rede). **Mesma não-regressão das Fases 4.5/5** — a DONA valida localmente |
| `prisma validate` | ⚠️ Falha por rede (403 em `binaries.prisma.sh`) — limitação do sandbox, não é erro de código |
| `git diff --check` | ✅ Limpo |

---

## 11. ARQUIVOS CRIADOS / ALTERADOS

**Criados (novos):**

```
src/app/(app)/calendario/page.tsx
src/components/planning/calendar-client.tsx
src/lib/planning/db.ts
src/lib/planning/content.ts
src/lib/planning/calendar.ts
src/lib/planning/copy-versions.ts
src/lib/planning/weekly-plan.ts
src/lib/planning/index.ts
src/lib/validators/planning.ts
src/lib/publishing/index.ts
src/lib/publishing/instagram/index.ts
src/lib/publishing/tiktok/index.ts
src/app/api/calendar/route.ts
src/app/api/calendar/detail/route.ts
src/app/api/calendar/duplicate/route.ts
src/app/api/calendar/experiments/route.ts
src/app/api/calendar/copy-versions/route.ts
src/app/api/calendar/copy-versions/restore/route.ts
src/app/api/calendar/weekly-plan/route.ts
```

**Alterados:**

```
prisma/schema.prisma            (+216 linhas: 3 models + relações no User)
src/types/prisma-shim.d.ts      (+110 linhas: bloco Fase 6)
src/lib/navigation.ts            (item Calendário)
src/lib/validators/index.ts      (reexport planning)
src/components/ai/ideas-client.tsx (botão "Planejar no calendário")
src/lib/gamification/xp.ts       (XP "planejar-conteudo" = 10)
```

**Não alterados (preservados por regra):** models/motores da Fase 5 (metas, XP, conquistas), Knowledge Engine, identidade visual, `apresentacao/`, integrações Meta/TikTok existentes (Fases 2/3) e o fluxo real de publicação (inexistente — proposital).

---

## 12. COMANDOS QUE A DONA PRECISA RODAR LOCALMENTE

```bash
# 1. Sincronizar o schema no banco (Neon)
npx prisma validate
npx prisma generate
npx prisma db push
```

> **Nenhum seed é necessário** — a Fase 6 não cria tabelas globais novas (experimentos e metas já existem das Fases 4.5/5). O catálogo de conquistas já foi seeded na Fase 5.

```bash
# 2. Validação
npx tsc --noEmit
npm run build
```

```bash
# 3. Commit/push (a DONA autoriza localmente; o sandbox não tem permissão de push — 403)
git add -A
git commit -m "Fase 6: planejamento, calendário e pipeline de conteúdo"
git push
```

---

## 13. PENDÊNCIAS

1. **Nenhuma pendência de código** — Fase 6 implementada e `tsc` limpo (exit 0).
2. **Build não verificado localmente** pela DONA (sandbox não baixa o SWC binary) — mesmas limitações das fases anteriores.
3. **Banco** — `prisma db push` ainda NÃO executado (a DONA roda localmente). Nenhum seed novo é necessário.
4. **Nenhum commit/push** feito (aguardando autorização, conforme regra).
5. **Fase 7 NÃO iniciada** — aguardando validação desta Fase 6 (regra de bloqueio da fila).

---

## 14. CONCLUSÃO

A Fase 6 está **100% implementada, auditada e typechecked**. O calendário é **ancorado em dados reais** (nada de métricas inventadas), **nunca publica automaticamente**, **diferencia agendamento interno de publicação real**, **versiona copies sem sobrescrever**, **conversa com Ideias, Copy, Preview Social, Knowledge Engine, Experimentos e Metas da Fase 5** e **preserva a identidade visual aprovada**. A arquitetura de publicação está preparada (adapters genéricos retornando `ok: false`) para a fase futura autorizada pela DONA. Resta apenas a DONA rodar `prisma db push`, `npm run build` e commit/push localmente, e validar. Fase 6 encerrada — **aguardando validação**.
