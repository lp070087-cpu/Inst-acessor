# Relatório — Correções Asaas oficial + Etapa 0 (JSX)

Data: 2026-09-13
Escopo: Etapa 0 (correção dos 33 erros de TypeScript) + Etapa 1 (alinhamento ao
contrato oficial do Asaas) + CNPJ + validação.
Status: **sem commit, sem push, sem deploy.**

---

## ETAPA 0 — os 33 erros de TypeScript

**Causa raiz única (2 arquivos, 1 padrão):** um comentário na forma
`{/* ... */}` estava posicionado como **primeiro item de uma expressão** — no
ramo de um ternário e no `return` implícito de um arrow function — onde só
cabe um elemento JSX. Nessa posição o parser quebra e o TypeScript reporta
erros em cascata apontando linhas que estão corretas.

- `src/app/admin/page.tsx` — dentro de `adminEmails.map((email) => ( ... ))`.
  Corrigido convertendo para comentário JS (`//`).
- `src/components/publishing/publishing-client.tsx` — como primeiro item do
  ramo final de um ternário. Corrigido convertendo para comentário JS (`//`).

Nenhuma linha de JSX foi reescrita; nenhuma tag foi alterada; a
funcionalidade permanece exatamente a mesma. Os erros em cascata
(`has no corresponding closing tag`, `TS1005: ')' expected`) desaparecem
porque a causa era única.

Varredura de confirmação: busca por `(` seguido de `{/*` em todo o `src/`
não retornou nenhuma outra ocorrência. Os dois pontos eram os únicos.

---

## ETAPA 1 — Asaas oficial

### 1. `customer` estava correto?

Sim. O campo `customer` **já existia** no tipo `AsaasCheckoutRequest` e já era
o nome usado. Não houve renomeação.

### 2. Existia `customerData` conflitante?

Não. `customerData` **não existia** no código. Portanto **não havia conflito**
(nunca eram enviados juntos) — mas o caminho do comprador **sem** customer
Asaas estava incompleto: nenhum dado de cliente era enviado. Foi adicionado.

### 3. Existia `subscriptionCycle` incorreto?

**Sim.** O `POST /v3/checkouts` era montado com um campo de ciclo fora do
contrato oficial.

### 4. Foi alterado para `subscription.cycle`?

Sim — e somente isso. Hoje o request recorrente envia:

```ts
subscription: { cycle: "MONTHLY" | "YEARLY", nextDueDate: "YYYY-MM-DD" }
```

`subscriptionCycle` não existe mais no código (as três ocorrências restantes
são apenas comentários que registram a correção). Também foram adicionados
`chargeTypes` e `billingTypes`, que antes não existiam.

### 5. Header final do webhook

`asaas-access-token`. É a **única** fonte aceita. O fallback
`Authorization: Bearer` foi **removido** (era porta a mais sem necessidade).
Token por query string continua proibido.

### 6. `ASAAS_WEBHOOK_TOKEN`

É a variável comparada, em tempo constante (`timingSafeEqual`), contra o valor
do header. Regra oficial embutida: o `authToken` tem 32 a 255 caracteres, não
contém espaços e **não pode ser a API Key**. O painel de Webhooks passou a
exibir o **veredito de formato** desse token (nunca o valor): "Formato válido",
"Formato inválido...", "Inválido: é igual à API Key" ou "Não configurado".

### 7. Eventos de assinatura

Mantidos exatamente os quatro confirmados:
`SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`,
`SUBSCRIPTION_DELETED`.

### 8. Tratamento do `CHECKOUT_PAID`

Antes: o evento **não estava na allowlist** — um `CHECKOUT_PAID` legítimo seria
recusado como desconhecido. Agora está na allowlist e tem tratamento próprio
em `applyOrderLifecycle`, que **não libera nada**: apenas registra na auditoria
do `CheckoutOrder` que o checkout foi concluído, com a nota explícita de que o
acesso ainda não foi liberado. Se a ordem já estiver `PAID`, o tratamento
retorna `noop` — reforçando que o evento não reescreve o estado de pagamento.
Também foi adicionado suporte ao objeto `checkout` do payload
(`externalReference` e `id`) para que o evento localize a ordem corretamente.

### 9. `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`

Continuam sendo a **única** fonte de liberação de acesso — a arquitetura já era
assim. A liberação só ocorre depois de o servidor validar que o valor recebido
bate com `order.expectedAmountCents` e com `plan.priceCents`. Nada foi
duplicado.

### 10. Checkout avulso

`chargeTypes: ["DETACHED"]` para planos não recorrentes. `billingTypes` envia
apenas a forma definida pelo servidor (`ASAAS_BILLING_TYPE`).

### 11. Checkout recorrente

`chargeTypes: ["RECURRENT"]` + `subscription: { cycle, nextDueDate }`.

### 12. Idempotência

Preservada. `BillingEvent.eventId` é único, com claim-first; replay retorna
`duplicate` sem reprocessar; falha mantém `processed=false` e devolve 5xx para
o Asaas reenviar. O `CHECKOUT_PAID` entra nesse mesmo mecanismo e, mesmo que
chegue repetido, cai em `noop`.

### 13. Admin > Assinaturas

Asaas segue como **gateway oficial** (selo + quatro estados: API, Webhook,
Ambiente, Checkout). InfinitePay aparece **apenas** como registro histórico
("InfinitePay (histórico)"). Nenhuma chave é exibida.

### 14. Admin > Integrações

Card do Asaas com selo "Gateway oficial" e os quatro estados
(API / Webhook / Ambiente / Checkout). Nenhuma API Key é exibida. Foi
acrescentada a linha informando que a autenticação do webhook é pelo header
`asaas-access-token`, com o valor nunca exibido.

### 15. Admin > Webhooks

Card "Asaas — pagamentos e assinaturas" com selo "Gateway oficial", endpoint
oficial `https://unitrixapp.com.br/api/webhooks/asaas` (e o URL do ambiente
atual), e agora a linha **Autenticação: `asaas-access-token`**, mais o veredito
de formato do token. Os eventos de checkout passaram a ser classificados como
objeto "Checkout" na tabela. InfinitePay aparece em card separado, como
**histórico legado**.

### 16. InfinitePay

Fora dos fluxos ativos. Endpoint preservado apenas para não perder eventos
antigos; exibido como histórico. Não foi removido código nem dado.

### 17. CNPJ

**CNPJ da Unitrixapp não encontrado no projeto — necessário informar o número.**

Busca feita em todos os arquivos do projeto (código, docs, `.env.example`,
config): as únicas ocorrências são o comentário com o formato de exemplo
`00.000.000/0000-00` e a variável `NEXT_PUBLIC_UNITRIXAPP_CNPJ`, vazia.
Nenhum número foi inventado. O rodapé já está preparado: exibe a linha
"CNPJ ..." apenas quando a variável tiver valor.

### 18. TypeScript

**NÃO EXECUTADO.** O sandbox Linux está indisponível nesta sessão (falha na
montagem do share de arquivos; oito tentativas seguidas, não há o que
repetir). Não é possível rodar `npx prisma generate`, `npx prisma validate`,
`npx tsc --noEmit` nem `npm run build` aqui. **Nada foi fingido.** A validação
precisa rodar no Windows, na máquina da dona do projeto.

### 19. Build

**NÃO EXECUTADO** — mesma causa do item 18.

### 20. Instagram

**Não foi alterado.** Instagram Business Login, OAuth, callback, escopos,
tokens, `SocialConnection` e `TOKEN_ENCRYPTION_KEY` permanecem intactos.
Nenhum arquivo dessas áreas foi tocado nesta rodada.

### 21. Dados no Neon

**Nada foi apagado.** Nenhum `db push`, nenhum reset, nenhuma migration
executada, nenhum `UPDATE`/`DELETE`. As alterações são exclusivamente de
código, e a única mudança de schema nesta rodada foi **nenhuma** — o
`CheckoutOrder.audit` (Json) já existia.

---

## Arquivos alterados nesta rodada

| Arquivo | O que mudou |
| --- | --- |
| `src/app/admin/page.tsx` | Comentário `{/* */}` → `//` (causa raiz dos 33 erros) |
| `src/components/publishing/publishing-client.tsx` | Comentário `{/* */}` → `//` (causa raiz dos 33 erros) |
| `src/lib/billing/asaas/types.ts` | `subscription.cycle`; `chargeTypes`; `billingTypes`; `customerData`; objeto `checkout` no payload; `CHECKOUT_PAID` na allowlist |
| `src/lib/billing/asaas/hosted-checkout.ts` | Reescrito: recorrente vs avulso, customer/customerData exclusivos |
| `src/lib/billing/asaas/checkout-order.ts` | Passa nome/e-mail do comprador para montar `customerData` |
| `src/lib/billing/asaas/webhook.ts` | Extrai `externalReference`/`id` do objeto `checkout` |
| `src/lib/billing/asaas/events.ts` | Caso `CHECKOUT_PAID` (só auditoria, sem liberar) + referência do checkout |
| `src/lib/billing/asaas/config.ts` | `asaasWebhookTokenIssue()` — valida o FORMATO do token (nunca o valor) |
| `src/lib/billing/asaas/index.ts` | Exporta os tipos e a validação novos |
| `src/app/api/webhooks/asaas/route.ts` | `extractToken` só pelo header `asaas-access-token` |
| `src/app/admin/webhooks/page.tsx` | Linha "Autenticação"; veredito de formato do token; objeto "Checkout" |
| `src/app/admin/integracoes/page.tsx` | Linha sobre o header de autenticação |
| `.env.example` | Regras oficiais do `ASAAS_WEBHOOK_TOKEN` |

## Pendências para a dona do projeto

1. Rodar no Windows: `npx prisma generate`, `npx prisma validate`,
   `npx tsc --noEmit`, `npm run build`.
2. Fornecer o CNPJ da Unitrixapp (o mesmo cadastrado no app da Meta) para
   preencher `NEXT_PUBLIC_UNITRIXAPP_CNPJ`.
3. Conferir que o `authToken` cadastrado no painel do Asaas (Webhook → Token de
   autenticação) e a variável `ASAAS_WEBHOOK_TOKEN` na Vercel têm **exatamente**
   o mesmo valor, com 32 a 255 caracteres, sem espaços e diferente da API Key.
