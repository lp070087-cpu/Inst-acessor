# INST ACESSOR — CÉREBRO ESTRATÉGICO (KNOWLEDGE ENGINE)

> **Fase 4.5 — documento técnico-normativo.**
> Descreve a arquitetura do "Cérebro Estratégico": base de conhecimento oficial, motores de diagnóstico, experimentos, padrões e Score oficial.
> Data: **2026-08-27** · Versão: **1.0** · Status: **VIGENTE**

---

## 1. FILOSOFIA

O Inst Acessor **não inventa conhecimento**. A IA e os motores de diagnóstico respondem exclusivamente com:

- **DADOS REAIS** do usuário (snapshots, métricas, conteúdo);
- **CONHECIMENTO OFICIAL** fornecido pela DONA (30 módulos — única metodologia proprietária ativa);
- **INFERÊNCIAS** claramente rotuladas como tal;
- **HIPÓTESES** (para testar via experimentos, nunca como fato);
- **RECOMENDAÇÕES** com base no cruzamento dos itens acima.

A regra anterior de "não preencher a base de conhecimento" deixou de valer **exclusivamente para o conteúdo oficial fornecido pela DONA na Fase 4.5**. Nenhum conteúdo externo ou dica genérica foi adicionado.

### Categorias de evidência (nunca misturar)

| Categoria | O que é | Exemplo |
| --- | --- | --- |
| `DADO_REAL` | Medido/registrado do perfil do usuário | "Engajamento médio dos últimos 7 dias: 3,2%" |
| `CONHECIMENTO` | Regra oficial fornecida pela DONA | "Consistência é mais importante que volume" (Módulo 10) |
| `INFERENCIA` | Dedução a partir de dados reais, rotulada | "Há indícios de que Reels com gancho direto retêm melhor" |
| `HIPOTESE` | Suposição a ser testada | "Se eu postar 5x/semana, meu alcance sobe?" |
| `RECOMENDACAO` | Ação sugerida com base no contexto | "Teste o formato carrossel por 2 semanas" |

---

## 2. OS 30 MÓDULOS OFICIAIS

O conhecimento oficial é organizado em **30 módulos numerados (01–30)**, agrupados por área:

### Princípio Central (Módulos 01–02)
- **01** — Princípio Central: ciclo principal, objetivo do sistema, combinação IA + intuição da DONA.
- **02** — Quatro Pilares: Conteúdo, Retenção, Distribuição, Conversão.

### Conteúdo e Posicionamento (Módulos 03–09)
- **03** — Bio e Posicionamento.
- **04** — Público-alvo (hipóteses de público).
- **05** — Unidade de conteúdo.
- **06** — Ganchos (tipos, pergunta central).
- **07** — Retenção (estrutura, elementos).
- **08** — Reels (análise, alerta de Reel fraco).
- **09** — Stories (função, leitura de Reels × Stories).

### Métricas e Diagnóstico (Módulos 10–19)
- **10** — Frequência de postagem.
- **11** — Engajamento.
- **12** — Alcance.
- **13** — Crescimento (referência contextual ~0,5%).
- **14** — Visitas (separar distribuição de conversão).
- **15** — Snapshots (histórico obrigatório).
- **16** — Comparação (período anterior; referência contextual ~1%).
- **17** — Alertas oficiais (severidade ALTA/MÉDIA/BAIXA).
- **18** — Categorias de diagnóstico.
- **19** — Growth Score (ponderação oficial, explicabilidade, resumo de saúde).

### Estratégia e Motor de Crescimento (Módulos 20–30)
- **20** — Diagnóstico com IA.
- **21** — Regra Fundamental (regra confiável, nunca inventar métricas, toda resposta tem base).
- **22** — Estratégia personalizada.
- **23** — Ideias (precisam de contexto).
- **24** — Copy (usa estratégia).
- **25** — Calendário (execução).
- **26** — Mentoria (contexto).
- **27** — Aprendizado contínuo.
- **28** — Gamificação (elementos; referência contextual ~70% XP).
- **29** — Métricas (lista oficial; nunca assumir disponibilidade).
- **30** — Motor de Crescimento (passos).

> ⚠️ Os valores citados (~0,5%, ~1%, ~70%) são **referências contextuais**, NÃO constantes universais. A interpretação depende dos dados reais de cada perfil.

---

## 3. ARQUITETURA

```
src/lib/knowledge/
├── types.ts              → tipos centrais (regras, evidências, experimentos, alertas, baseline)
├── rules/
│   ├── core.ts           → módulos 01, 02, 21
│   ├── content.ts        → módulos 03–09
│   ├── metrics.ts        → módulos 10–19
│   ├── strategy.ts       → módulos 20–30
│   └── registry.ts       → registro oficial (valida exatamente 30 módulos)
├── repository.ts         → delegate `kb` tipado (padrão Fase 4)
├── baseline.ts           → baseline individual (mediana, período anterior, top quartil)
├── context-builder.ts    → retrieval contextual por categoria/tags (RAG-ready)
├── alerts.ts             → motor de alertas determinístico
├── experiments.ts        → motor de experimentos (sem estatística fictícia)
├── patterns.ts           → motor de padrões (associação observada, nunca causalidade)
└── index.ts              → barrel público
```

**APIs**

| Rota | Métodos | Função |
| --- | --- | --- |
| `/api/alertas` | GET | Gera alertas determinísticos por plataforma |
| `/api/experimentos` | GET/POST/PATCH/DELETE | CRUD de experimentos, variantes e observações |
| `/api/padroes` | GET/POST/DELETE | Lista/cria/exclui insights e descobre padrões observados |
| `/api/baseline` | GET | Calcula a baseline individual do usuário |

---

## 4. VERSIONAMENTO

- A base de conhecimento é **versionável**: `KnowledgeVersion` (número + label + ativo).
- Regras e módulos possuem **slug único + versão** (`@@unique([slug, version])`).
- O seed é **idempotente** (`prisma/seed-knowledge.ts`): roda N vezes sem duplicar, usando `upsert` por `slug + version`.
- Conhecimento é **GLOBAL** (sem `userId`). Aprendizado individual fica nos models por `userId` (`ProfileInsight`, `GrowthExperiment`, `AIProfile`).

### Rodando o seed (somente quando autorizado)

```bash
npx tsx prisma/seed-knowledge.ts
```

> ⚠️ **NÃO executar automaticamente contra produção.** A DONA roda localmente após revisar o schema.

---

## 5. RETRIEVAL CONTEXTUAL (RAG-READY)

O `context-builder.ts` implementa **retrieval contextual determinístico** — não despeja os 30 módulos em cada prompt:

1. Normaliza a consulta (NFD);
2. Consulta o `QUERY_MAP` (19 grupos de palavras-chave → tags/categorias);
3. Casa com `tags` e `categoria` das regras;
4. Limita a **12 regras** relevantes por requisição;
5. Se nada casar, usa fallback: `ciclo-principal`, `nunca-inventar-metricas`, `toda-resposta-tem-base`;
6. Monta o contexto com seções: **DADOS REAIS / HISTÓRICO / CONHECIMENTO OFICIAL APLICÁVEL / APRENDIZADO DO PERFIL / EXPERIMENTOS** + formato de resposta.

Isso mantém o prompt enxuto, reduz custo e deixa o caminho pronto para RAG semântico futuro.

---

## 6. EXPERIMENTOS

Motor de experimentos com **estados controlados**:

| Estado | Significado |
| --- | --- |
| `DRAFT` | Rascunho, ainda não começou |
| `RUNNING` | Em execução (`startedAt` preenchido) |
| `ENOUGH_DATA` | Dados suficientes para análise |
| `CONFIRMED` | Hipótese confirmada (`endedAt`) |
| `REJECTED` | Hipótese rejeitada (`endedAt`) |
| `INCONCLUSIVE` | Sem dados suficientes — **padrão honesto** |
| `ARCHIVED` | Arquivado (`endedAt`) |

**Regras:** sem estatística fictícia; amostra insuficiente → `INCONCLUSIVE`; toda observação registra `metric + before + after + delta`; `confidence` opcional e explicitamente declarada.

---

## 7. PADRÕES E BASELINE

### Baseline individual

- `median(values)` + `computeIndividualBaseline(userId, platform)` usando os **dados reais** de snapshots.
- Classifica o valor atual como **acima-da-mediana / na-media / abaixo-da-mediana** (limites contextuais 1,25× / 0,75×).
- Comparação com **período anterior** e leitura de **top quartil** como referências.

### Motor de padrões

- `discoverObservedPatterns` gera apenas **associações observadas** ("O melhor dia de alcance foi X"), **nunca causalidade** sem experimento.
- Tipos de insight: `OBSERVED` / `INFERRED` / `CONFIRMED_BY_EXPERIMENT`.
- **Nunca** promover automaticamente uma inferência a fato confirmado — apenas um experimento pode fazê-lo.

---

## 8. INTEGRAÇÕES COM A IA

| Área | Como usa o knowledge engine |
| --- | --- |
| **IA Acessor (chat)** | `buildKnowledgeContext` + `knowledgeContextToPrompt` — contexto enxuto por consulta; separa DADO REAL / CONHECIMENTO / INFERÊNCIA / HIPÓTESE / RECOMENDAÇÃO |
| **Mentoria** | Recomendações ancoradas em regras oficiais (`ruleSlug`), com `evidence`, `test` e `result` |
| **Ideias** | Regra oficial `ideias-precisam-contexto` + `rationale` ("Por que esta ideia foi sugerida?") |
| **Copy** | Regras oficiais de gancho/retenção/copy (`copy-usa-estrategia`); gancho deve combinar com a entrega |

---

## 9. GROWTH SCORE OFICIAL v1

**`growth-score-v1`** — pesos oficiais:

| Pilar | Peso |
| --- | --- |
| Engajamento | 30% |
| Crescimento | 25% |
| Alcance | 25% |
| Consistência | 20% |

- Pilares complementares (frequência, conteúdo) aparecem como contexto, sem peso.
- **Métrica indisponível NUNCA recebe 0.** Os pesos das métricas disponíveis são **redistribuídos**.
- O score expõe **"Cobertura dos dados: X%"** — transparência sobre o que foi possível medir.
- Fórmula é **versionável** (`version: string`) e o `weighting` é persistido.

---

## 10. ALERTAS DETERMINÍSTICOS

Motor de alertas **sem IA** (regras puras + dados reais):

- Alcance caiu / subiu (±10% vs. período anterior);
- Engajamento caiu / subiu;
- Crescimento desacelerando;
- Dias sem postar (limiar configurável);
- Reel fraco / conteúdo acima da média;
- TikTok: likes, crescimento, dias sem postar.

Severidade: **ALTA > MÉDIA > BAIXA** (ordenável). Referências contextuais, não constantes universais.

---

## 11. SEGURANÇA E ISOLAMENTO

- **Conhecimento**: global (leitura para todos os usuários autenticados).
- **Aprendizado individual** (`AIProfile`, `ProfileInsight`, `GrowthExperiment`): **por `userId`**.
- Toda query por `id` verifica o `userId` do dono antes de ler/atualizar/excluir.
- APIs exigem sessão autenticada (`requireSession`/`requireOnboardedSession`).
- Nenhuma chave de IA em client components (`process.env` só no servidor).
- Sem `as any`, `@ts-ignore` ou `@ts-expect-error` no código novo.

---

## 12. PREPARAÇÃO PARA ADMIN

Os models e APIs foram desenhados para uma futura **Central Admin**:

- `KnowledgeVersion` → administrar versões da base;
- `KnowledgeModule` / `KnowledgeRule` → CRUD de módulos e regras (ativação, prioridade, tags);
- Visualização de experimentos e insights por usuário (somente leitura para Admin, com isolamento preservado).

Nenhuma página Admin foi criada nesta fase (fora do escopo).

---

## 13. SEED — RESUMO

`prisma/seed-knowledge.ts` insere apenas o conteúdo oficial da DONA:

1. `KnowledgeVersion` v1;
2. 30 `KnowledgeModule` (upsert por slug);
3. Todas as regras (upsert por `slug + version`, vinculadas ao módulo e à versão).

Valida no boot que existem **exatamente 30 módulos** (senão, lança erro). Idempotente por construção.

---

## 14. EXPANSÃO FUTURA

- **RAG semântico**: embeddings sobre as regras (o `QUERY_MAP` determinístico já é o fallback/seed do retrieval).
- **Novos módulos**: basta adicionar no `registry` (a validação de 30 vira 31+ após atualização do guard).
- **Novas versões**: `KnowledgeVersion` v2 sem quebrar a v1 (regras têm `slug + version`).
- **Experimentos com amostragem real**: quando houver volume, `ENOUGH_DATA` pode alimentar `CONFIRMED/REJECTED` com regras estatísticas formais.
- **Admin**: gestão de conteúdo pela DONA.
- **Calendário estratégico**: o Módulo 25 já fornece a base conceitual.

---

## 15. STATUS E VALIDAÇÃO

| Item | Status |
| --- | --- |
| `npx tsc --noEmit` | ✅ EXIT 0 |
| `npm run build` | ⚠️ Falha no sandbox (SWC binary ausente — limitação conhecida; DONA roda local) |
| `git diff --check` | ✅ limpo |
| Auditoria anti-`any`/`@ts-ignore` | ✅ limpa |
| Nenhum mock ativo | ✅ |
| Nenhum prompt com 30 módulos | ✅ (retrieval contextual, máx. 12) |
| Nenhuma métrica indisponível com valor 0 | ✅ (cobertura + redistribuição) |
| Nenhum acesso cross-user | ✅ (owner-check em todas as queries por id) |

> Este documento é **vivo**: atualize a cada nova decisão oficial da DONA.
