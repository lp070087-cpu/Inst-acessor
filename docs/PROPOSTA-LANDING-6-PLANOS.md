# Proposta — Apresentação dos 6 planos na página de vendas

> **STATUS: PROPOSTA. NADA FOI ALTERADO NA LANDING.**
> A página de vendas está congelada. Este documento lista exatamente o que
> precisaria mudar **quando o proprietário aprovar**. Nenhum preço, card,
> estrutura ou texto da landing foi tocado.

---

## 1. A divergência, com precisão

Hoje existem **três fontes** que descrevem "quais planos existem", e elas não
concordam:

| Fonte | O que diz | Arquivo |
|---|---|---|
| **Catálogo (backend)** | 6 planos vendáveis + 2 legados = 8 | `src/lib/billing/plans/catalog.ts` |
| **Ordem da landing** | `["semanal", "mensal", "anual"]` | `src/components/landing/sections-d.tsx:335` |
| **Planos ATIVOS** | semanal, mensal, anual (os 5 novos estão `active: false`) | catálogo + coluna `Plan.active` |

A landing **não está "desatualizada" por acidente**: ela filtra
`PLAN_CATALOG.find((p) => p.slug === slug && p.active)` usando a SUA própria
lista de 3 slugs. Ou seja, ela mostra semanal/mensal/anual porque:

1. esses 3 slugs estão na lista local `LANDING_PLAN_ORDER`; **e**
2. os 3 estão com `active: true`.

Os 5 planos novos não aparecem **porque os dois critérios falham** (não estão na
lista local **e** estão inativos). Quando o proprietário decidir ativar, os dois
pontos precisam mudar **juntos** — mudar só um não produz o resultado esperado.

**Consequência prática hoje:** o checkout cobra exatamente o que o catálogo diz.
A landing e o checkout concordam nos 3 planos que ela mostra. Não há cobrança
errada — há **planos que a landing ainda não anuncia**.

---

## 2. Componentes que precisariam ser alterados

| # | Arquivo | Mudança necessária | Risco |
|---|---|---|---|
| 1 | `src/components/landing/sections-d.tsx:335` | `LANDING_PLAN_ORDER` → os 6 slugs na ordem comercial | **Alto** — é o coração da seção de planos |
| 2 | `src/lib/billing/plans/catalog.ts` | Ativar (`active: true`) os 5 planos, **ou** usar o override do admin (`/admin/planos`) | **Alto** — ativação comercial |
| 3 | `src/lib/billing/plans/display.ts:197` (`LANDING_PLAN_FEATURES`) | Lista ÚNICA de benefícios usada por todos os cards | Médio |
| 4 | `src/app/landing.css` (`.lnd-plans-grid`, `.lnd-plan-card`) | Hoje é um grid de 3 colunas; 6 cards exigem 2–3 por linha + scroll/empilhamento | **Alto** — quebra de layout |
| 5 | `src/components/landing/sections-d.tsx` (card) | Espaço para mostrar a franquia de cada plano (é o que hoje diferencia) | Médio |

**Nenhum destes foi alterado.**

---

## 3. O problema de conteúdo (não é só código)

Hoje **todos os planos compartilham `FEATURES_BASE`** — a lista de recursos é
idêntica nos 8. O que diferencia os planos são as **franquias**
(`src/lib/billing/plans/limits.ts`), não as funções.

Isso cria uma decisão de produto que **precisa do proprietário**:

- **Opção A — mesma lista de recursos, franquia em destaque.**
  Os 6 cards mostram os mesmos benefícios e cada um exibe "10 gerações de IA/dia",
  "100 respostas/ciclo" etc. Honesto e coerente com o backend.
  *Risco:* 6 cards com o mesmo texto podem parecer repetitivos.
- **Opção B — recursos progressivos.**
  Cada plano anuncia só o que ganha sobre o anterior. Exige criar a lista de
  benefícios por plano (não existe hoje) e **manter isso igual ao backend**.
  *Risco:* divergência futura se a franquia mudar e o texto não.

Recomendação: **Opção A**, porque a franquia é a única diferença REAL hoje.
Anunciar recursos diferentes dos que o backend entrega seria inconsistente.

---

## 4. Coerência obrigatória landing ↔ checkout

Qualquer apresentação futura **precisa continuar vindo do catálogo** — nunca de
números escritos no componente. A regra já existe e deve ser mantida:

- Preço: `PLAN_CATALOG[slug].priceCents` (centavos inteiros).
- Promoção: `getPlanPromoDisplay()` (a MESMA config que o checkout cobra).
- Ordem/nomes: derivados do catálogo.

Um teste de regressão já existe: `bench/test-promo-landing.mjs` trava preços e
textos anunciados dos 3 planos atuais. **Ao migrar para 6 planos, esse teste
precisa ser atualizado junto** — ele é a rede de segurança que impede a landing
de anunciar um preço diferente do que o checkout cobra.

---

## 5. Ordem sugerida de execução (quando aprovado)

1. Decidir a **Opção A ou B** de conteúdo (seção 3).
2. Decidir o destino de `mensal`/`anual` na vitrine:
   - **esconder** (recomendado — são legados, só para contratos vigentes), ou
   - manter como "planos anteriores".
3. Ativar os 5 planos **pelo admin** (`/admin/planos`), não por edição de código.
4. Ajustar `LANDING_PLAN_ORDER` e o grid CSS.
5. **Atualizar `bench/test-promo-landing.mjs`** para os 6 planos.
6. Conferir em desktop, tablet e celular (o grid de 3 vira 6 cards).

---

## 6. O que NÃO deve ser feito

- Não ativar os planos novos sem a decisão comercial do proprietário.
- Não escrever preço/benefício à mão no componente (quebra a coerência).
- Não prometer "ilimitado" — as franquias são finitas e medidas.
- Não anunciar promoção que não seja desconto real (o servidor já recusa).
- Não tocar em `mensal`/`anual` existentes: há 1 assinatura ativa e 7 pedidos
  históricos no plano anual.
