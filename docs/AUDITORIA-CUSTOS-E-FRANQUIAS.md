# Auditoria de Custos por Plano e Sustentabilidade das Franquias

> **Nenhum valor de fornecedor foi inventado.** Os custos unitários estão
> marcados como **PENDENTE** onde não há preço confirmado no projeto. As
> hipóteses estão explícitas para que o proprietário possa substituí-las.
>
> Objetivo: dar base para **aprovar (ou ajustar) as franquias** de
> `src/lib/billing/plans/limits.ts`, que hoje estão em modo **somente medição**
> (`LIMITS_ENFORCEMENT_ENABLED = false`).

---

## 1. O que o plano realmente limita

Só três coisas geram **custo variável** para o Inst Acessor:

| Capacidade | O que roda por baixo | Custo variável? |
|---|---|---|
| `ai_generation` | OpenAI/Gemini (tokens) | **SIM** |
| `auto_reply` | IA (classificar + gerar) **+** chamada à Meta | **SIM** |
| `profile_analysis` | IA (análise/diagnóstico) | **SIM** |
| `publication` | Só API da Meta (sem IA) | **NÃO** (custo fixo por chamada, sem token) |
| `automation_rule` / `connected_accounts` | Teto de entidades | **NÃO** |

**Conclusão:** franquia de publicação e de contas **não protegem custo de IA** —
elas protegem **limite de API social** e **carga de banco**. Isso precisa estar
claro na decisão: quem paga a conta de IA são `ai_generation`, `auto_reply` e
`profile_analysis`.

---

## 2. Consumo real por operação (medido no CÓDIGO, não estimado)

Teto de saída configurado hoje (`maxTokens`):

| Operação | Arquivo | Saída máx. |
|---|---|---|
| Classificar comentário | `comment-replies/classify.ts` | 8 tokens |
| Gerar resposta a comentário | `comment-replies/generator.ts` | 120 |
| Sugerir resposta de DM | `comment-direct/conversation.ts` | 200 |
| Insights do dashboard | `dashboard/insights.ts` | 320 |
| Perfil aprendido | `ai/services/learned-profile.ts` | 900 |
| Plano semanal (IA) | `planning/weekly-plan.ts` | 900 |
| Ideias | `ai/services/ideas.ts` | 1500 |
| Copy | `ai/services/copy.ts` | (padrão do provider) |

**Entrada é o que pesa.** O teto de entrada é `AI_MAX_INPUT_CHARS = 60.000`
caracteres ≈ **15k–18k tokens** no pior caso, com `AI_MAX_SYSTEM_CHARS = 24.000`
(≈6k tokens) só de contexto. Uma chamada de IA Acessor com contexto completo
consome **muito mais entrada que saída** — o custo é dominado pelo contexto, não
pela resposta. Isso é o principal risco de custo.

---

## 3. Custo unitário — PENDENTE

Os preços de OpenAI, Gemini, Neon, Vercel e Asaas **não estão no projeto** e
mudam com o tempo. Para não inventar:

| Fornecedor | O que falta | Como obter |
|---|---|---|
| OpenAI | preço por 1k tokens de entrada/saída do modelo em uso (`gpt-4o-mini`) | painel OpenAI |
| Google Gemini | preço por 1k tokens do modelo em uso (`gemini-3.5-flash-lite`) | painel Google AI |
| Neon | custo do plano + transferência | painel Neon |
| Vercel | plano + invocações/função | painel Vercel |
| Asaas | taxa por transação PIX/cartão + % | painel Asaas |

**Sem estes números não é possível afirmar se uma franquia é lucrativa.** O que
este documento faz é dar o **volume** — o proprietário multiplica pelo preço real.

---

## 4. Cenários de consumo (hipóteses explícitas)

Hipóteses assumidas, a serem confirmadas com dados reais:

- `H1` — 1 geração de IA simples (copy/ideias/chat): **~2k tokens de entrada**
  (contexto moderado) + **~500 de saída**.
- `H2` — 1 geração pesada (IA Acessor com contexto completo): **~15k entrada** +
  **~800 saída**.
- `H3` — 1 resposta automática = 1 classificação (8 tok saída, entrada pequena)
  + 1 geração (120 tok saída, entrada média) → conta como **1 unidade** de
  `auto_reply`.
- `H4` — 1 análise de perfil: **~5k entrada** + **~900 saída**.
- `H5` — Tokens de entrada custam ~4× os de saída em modelos "mini/lite"
  (proporção típica de mercado — **confirmar**).

| Plano | Franquia IA/dia | Franquia IA/ciclo | Cenário BAIXO (30% do ciclo, só H1) | Cenário MÉDIO (60%, metade H1 metade H2) | Cenário ALTO (100%, tudo H2) |
|---|---:|---:|---|---|---|
| Start | 10 | 100 | 100 ger. leves | 50 leves + 50 pesadas | 100 pesadas |
| Essencial | 25 | 300 | 300 leves | 150 + 150 | 300 pesadas |
| Pro | 50 | 700 | 700 leves | 350 + 350 | 700 pesadas |
| Elite | 100 | 1500 | 1500 leves | 750 + 750 | 1500 pesadas |
| Master | 200 | 3000 | 3000 leves | 1500 + 1500 | 3000 pesadas |

**Teto de tokens por plano (ordem de grandeza, na hipótese ALTA = pior caso):**

| Plano | Tokens de entrada (ciclo) | Tokens de saída (ciclo) |
|---|---:|---:|
| Start | ~1,5 M | ~80 mil |
| Essencial | ~4,5 M | ~240 mil |
| Pro | ~10,5 M | ~560 mil |
| Elite | ~22,5 M | ~1,2 M |
| Master | ~45 M | ~2,4 M |

> Multiplique pelos preços reais por 1k tokens para obter o custo de IA no pior
> caso. **Se um plano não cobrir o pior caso, o preço está baixo ou a franquia
> está alta** — é exatamente o que esta auditoria existe para revelar.

---

## 5. Observações de risco

1. **Entrada domina.** O `AI_MAX_INPUT_CHARS = 60.000` permite uma única chamada
   pesada. A franquia conta **gerações**, não tokens. Um usuário que sempre usa o
   contexto completo consome muito mais que um que faz perguntas curtas, pelo
   **mesmo** custo de franquia. *Considerar, no futuro, limitar tokens por
   operação de forma mais agressiva antes de ativar o bloqueio.*
2. **`auto_reply` são DUAS chamadas de IA** (classificar + gerar) contadas como
   uma. O custo real por unidade é maior que o de `ai_generation`.
3. **Publicação não tem custo de IA**, mas consome limite da API da Meta — o
   teto atual (15–250/ciclo) é generoso comparado à realidade de uso.
4. **`profile_analysis`** roda no `/score` (2×) e em `/analise-de-desempenho`.
   É fácil um usuário navegando consumir várias sem perceber.
5. **O modo medição é a rede de segurança:** com `LIMITS_ENFORCEMENT_ENABLED =
   false`, nada bloqueia hoje. Só ativar **depois** de: (a) preços reais
   preenchidos, (b) algumas semanas de consumo real medido, (c) aprovação.

---

## 6. Recomendação

1. Preencher os preços PENDENTES da seção 3.
2. Coletar **2–4 semanas** de consumo real com o medidor já em produção
   (ele funciona sem bloquear).
3. Substituir as hipóteses `H1`–`H5` pelos números medidos.
4. Só então decidir se as franquias atuais ficam, sobem ou descem — e ligar o
   bloqueio.
