# RELATÓRIO — INFINITEPAY + PLANOS DO INST ACESSOR

Data: 2026-08-31
Branch: `checkpoint-fase8-fase9`
Escopo: conectar os planos oficiais aos checkouts **InfinitePay**, atualizar o preço anual oficial (**R$ 497,00 → R$ 547,00**) e preservar o Asaas como código legado. Sem commit/push/deploy. Nenhuma alteração no fluxo de primeiro acesso, identidade visual, autenticação, Instagram/TikTok, Publishing, Growth Engine.

---

## 1. PLANOS OFICIAIS (novo, após esta tarefa)

| Plano | Nome oficial | Preço | Ciclo | Checkout InfinitePay |
|---|---|---|---|---|
| Semanal | Inst acessor Semanal | R$ 27,00 (2700) | ONE_TIME · 7 dias | `…/lucas-66438449-2n4/QxyWJ8UOq6` |
| Mensal | Inst acessor mensal | R$ 77,00 (7700) | RECURRING · MONTH | `…/lucas-66438449-2n4/gC8t6WTiVQ` |
| Anual | Inst acessor Anual | **R$ 547,00 (54700)** | RECURRING · YEAR | `…/lucas-66438449-2n4/5LZNvhvbLY` |

> O preço anual anterior de **R$ 497,00 NÃO é mais válido**. Matemática anual oficial: ≈ **R$ 45,58/mês** · 12× R$ 77 = R$ 924 · **economia R$ 377**.

---

## 2. ARQUIVOS ANALISADOS (auditoria de preços)

- `src/lib/billing/plans/catalog.ts` — **fonte de verdade** dos preços/nomes/duração/ciclo.
- `src/lib/billing/plans/index.ts` — serviço (listPlans/getPlanById/getPlanBySlug + self-heal).
- `src/components/billing/assinatura-client.tsx` — cards da área `/assinatura`.
- `src/app/(app)/assinatura/page.tsx` — página server que alimenta o client.
- `src/components/landing/sections-d.tsx` — seção Planos da landing.
- `src/app/page.tsx` — landing (apenas verificação; nenhuma alteração de preço aqui).
- `src/lib/billing/checkout.ts` — fluxo de checkout (fallback legado).
- `src/lib/billing/provider/index.ts` — seletor de gateway.
- `src/lib/billing/adapters/asaas.ts` — adapter legado.
- `src/lib/billing/asaas/service.ts` — serviço legado.
- `src/lib/billing/asaas/config.ts`, `client.ts`, `webhook.ts`, `events.ts`, `types.ts` — legado.
- `src/lib/billing/asaas/index.ts` — barrel legado.
- `src/app/api/billing/plans/route.ts` — GET /api/billing/plans.
- `src/app/api/billing/checkout/route.ts` — POST /api/billing/checkout (legado).
- `scripts/billing-tests.ts` — testes determinísticos (preço anual).
- `prisma/schema.prisma` — comentário do campo `Plan.priceCents`.
- `docs/ESCOPO-OFICIAL.md` — seção 13 (planos e assinaturas).
- `.env.example` — variáveis de ambiente.
- `apresentacao/` — sem referências de preço (verificado).
- `pasta da ordem/` — prints da ordem (sem preços).

**Onde os preços estavam definidos (antes):**

| Local | Valor anual antes | Tipo |
|---|---|---|
| `src/lib/billing/plans/catalog.ts` | `priceCents: 49700` | Código (fonte de verdade) |
| `src/lib/billing/plans/index.ts` | doc `49700` | Comentário |
| `src/components/billing/assinatura-client.tsx` | `49700/12`, `7700*12-49700` | Matemática do card |
| `src/components/landing/sections-d.tsx` | `price: 497` | Seção Planos da landing |
| `scripts/billing-tests.ts` | `49700` | Teste do catálogo |
| `prisma/schema.prisma` | `49700` | Comentário |
| `docs/ESCOPO-OFICIAL.md` | R$ 497,00 (49700) | Documento permanente |
| `.env.example` | — | Sem preço |
| `RELATORIO-*.md` (raiz/docs) | R$ 497 etc. | Documentos históricos (NÃO alterados — são registros do passado) |

---

## 3. ARQUIVOS ALTERADOS

| Arquivo | Mudança |
|---|---|
| `src/lib/billing/plans/catalog.ts` | Nomes oficiais, anual `54700`, `checkoutUrl` por plano, docs |
| `src/lib/billing/plans/index.ts` | `PlanView.checkoutUrl`, `ensureCatalogPlans` sincroniza nome/preço (sem `checkoutUrl` no banco), overlay do catálogo, docs |
| `src/components/billing/assinatura-client.tsx` | `PlanView.checkoutUrl`, matemática anual 54700, CTA → InfinitePay (fallback Asaas), footer de pagamento |
| `src/app/(app)/assinatura/page.tsx` | Remove import Asaas config (não mais usado no checkout principal) |
| `src/components/landing/sections-d.tsx` | PLANS: anual 497→547, CTA hrefs → InfinitePay (nova aba) |
| `scripts/billing-tests.ts` | Teste do catálogo: anual 49700→54700; webhook `value: 547` |
| `prisma/schema.prisma` | Comentário `54700` (sem mudança estrutural) |
| `docs/ESCOPO-OFICIAL.md` | Seção 13: preço anual 547 + InfinitePay + nota de atualização |
| `.env.example` | Seção InfinitePay (reserva futura) + Asaas marcado como legado |
| `src/lib/billing/provider/index.ts` | Docs: InfinitePay oficial / Asaas legado |
| `src/lib/billing/adapters/asaas.ts` | Docs: legado preservado |
| `src/lib/billing/asaas/service.ts` | Docs: legado preservado |
| `src/lib/billing/checkout.ts` | Docs: fallback legado |

---

## 4. ONDE O 497 → 547 FOI APLICADO

- `src/lib/billing/plans/catalog.ts` → `priceCents: 54700`.
- `src/lib/billing/plans/index.ts` → overlay do catálogo (garante exibição 547 mesmo se o banco tiver linha antiga 49700).
- `src/components/billing/assinatura-client.tsx` → `54700/12`, `7700*12-54700`.
- `src/components/landing/sections-d.tsx` → `price: 547`.
- `scripts/billing-tests.ts` → `54700` + webhook `value: 547`.
- `prisma/schema.prisma` → comentário.
- `docs/ESCOPO-OFICIAL.md` → tabela oficial + matemática.

Os documentos históricos (`RELATORIO-*`, `RELATORIO-ASAAS-BILLING.md`, etc.) NÃO foram alterados: são registros de fases passadas e não refletem mais o estado atual — por isso o relatório presente registra a mudança.

---

## 5. ONDE CADA CHECKOUT FOI CONECTADO

- **Catálogo** (`catalog.ts`): cada plano tem `checkoutUrl` (link público InfinitePay).
- **`/assinatura`** (`assinatura-client.tsx`): card com `checkoutUrl` → `<a target="_blank" href={checkoutUrl}>` (abre o checkout do plano correto). Nunca mistura links. Sem `checkoutUrl` → fallback legado `/api/billing/checkout`.
- **Landing** (`sections-d.tsx`): cada CTA da seção Planos aponta para o checkout InfinitePay do plano correspondente, em nova aba. Preço anual exibido: **R$ 547**.

Mapeamento verificado por greps (cada link aparece exatamente 2× no código: catálogo + CTA correspondente):

| Plano | Link | Onde conectado |
|---|---|---|
| Semanal | `QxyWJ8UOq6` | catálogo + landing |
| Mensal | `gC8t6WTiVQ` | catálogo + landing |
| Anual | `5LZNvhvbLY` | catálogo + landing |

---

## 6. SITUAÇÃO DO CÓDIGO LEGADO ASAAS

- **Preservado integralmente** (nada deletado): `src/lib/billing/asaas/*`, `adapters/asaas.ts`, `provider/index.ts`, `checkout.ts`, webhook `/api/webhooks/asaas`, models `Plan/Subscription/Payment/BillingEvent`, registros no banco.
- **Marcado como LEGADO/descontinuado** em comentários de cabeçalho (não afeta compilação).
- **Nenhuma cobrança nova Asaas é iniciada** pelo fluxo principal: os cards agora abrem o checkout InfinitePay. O `/api/billing/checkout` (Asaas) permanece como fallback de código, mas a UI não o invoca quando há `checkoutUrl`.
- **Nenhuma aprovação de pagamento é simulada** — a liberação de acesso segue dependendo de confirmação real.

---

## 7. O QUE JÁ É FUNCIONAL

- Preços/nomes oficiais em todo o código (catálogo, `/assinatura`, landing).
- Checkout InfinitePay por plano nos cards do `/assinatura` e na landing.
- Self-heal `ensureCatalogPlans` sincroniza a tabela `Plan` com nome/preço do catálogo (sem precisar de seed) e garante que a exibição use sempre o valor do catálogo (overlay), mesmo com linha antiga no banco.
- `PlanView.checkoutUrl` propagado do servidor → client (links públicos, seguros no frontend).
- Testes determinísticos: billing 31/31, first-access 39/39, publishing 25/25, growth 28/28.

---

## 8. O QUE DEPENDE DA INTEGRAÇÃO WEBHOOK/API INFINITEPAY (NÃO implementado aqui)

- **Confirmação automática de pagamento → liberação de acesso.** O checkout InfinitePay ocorre fora do app (link externo). Para o app saber quando o pagamento foi confirmado e ativar/estender o acesso de forma automática, é necessária a integração de **webhook/API do InfinitePay** (fora do escopo desta tarefa, que foi exclusivamente conectar os links de checkout).
- Até essa integração existir, a liberação do acesso após o pagamento InfinitePay precisa de processo **manual/documentado** (ex.: admin libera via "Acesso liberado" com a origem correta).
- Variáveis reservadas no `.env.example` (documentação, sem valores inventados): `INFINITEPAY_API_KEY`, `INFINITEPAY_WEBHOOK_TOKEN`, `INFINITEPAY_ACCOUNT_ID`.

---

## 9. RESULTADO TYPESCRIPT

`NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` → **EXIT 0** (sem erros).

---

## 10. RESULTADO BUILD

`npx next build` → **EXIT 1**, apenas pela limitação conhecida do sandbox Linux: `@next/swc-linux-x64-gnu` não está instalado. Não é erro de código. A DONA deve validar o build localmente (Windows) com `npm run build`.

`git diff --check` → **EXIT 0** (sem whitespace/conflito).

---

## 11. RISCOS / PENDÊNCIAS

- **Pendência operacional (crítica para produção):** a liberação automática de acesso pós-pagamento InfinitePay depende da integração webhook/API InfinitePay (fora do escopo). Sem ela, o dono precisa liberar manualmente.
- **Banco:** a tabela `Plan` pode ainda conter o valor antigo 49700 em linhas existentes; o overlay do catálogo garante a exibição correta (547), mas a DONA deve rodar o self-heal/seed (ou um UPDATE) para alinhar a linha persistida. Nenhuma alteração destrutiva foi feita.
- **Nome dos planos:** nomes oficiais atualizados ("Inst acessor Semanal", "Inst acessor mensal", "Inst acessor Anual"). Verificar nos cards e na tabela `Plan`.
- **Landing:** apenas o preço anual (497→547) e os links de checkout foram alterados na seção Planos. Nenhum texto/ordem/paleta foi tocado.
- **Documentos históricos** mantêm o valor antigo; são registros de fases passadas e não foram editados de propósito.
- **Asaas legado:** nenhuma cobrança nova deve ser iniciada; o código permanece para referência/migração. Sem commit/push/deploy.

---

## VALIDAÇÕES EXECUTADAS

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | **EXIT 0** |
| `npm run billing:test` | **31/31** |
| `npm run first-access:test` | **39/39** |
| `npm run publishing:test` | **25/25** |
| `npm run growth:test` | **28/28** |
| `git diff --check` | **EXIT 0** |
| Greps de preço 497 em `src/ scripts/ prisma/` | **CLEAN** (só comentários legados explícitos) |
| Greps de links InfinitePay | 3 links × 2 ocorrências (catálogo + CTA) |
| Greps de credenciais | **NENHUMA** chave/token no frontend; sem `NEXT_PUBLIC_INFINITEPAY`/`NEXT_PUBLIC_ASAAS` |
| `npm run build` | **EXIT 1** — limitação SWC do sandbox (DONA valida local) |

---

## NÃO FEITO (conforme escopo)

- Nenhum commit, push, merge ou deploy.
- Nenhuma alteração destrutiva no banco/Neon.
- Nenhuma alteração no fluxo de primeiro acesso, identidade visual, autenticação, Instagram/TikTok, Publishing, Growth Engine.
- Nenhuma integração webhook/API InfinitePay real (apenas links de checkout).
- Nenhuma credencial logada/exibida.
