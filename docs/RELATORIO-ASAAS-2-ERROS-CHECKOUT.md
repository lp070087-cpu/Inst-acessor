# Relatório — Correção dos erros do checkout Asaas

**Data:** 2026-09-14
**Escopo:** SOMENTE os erros do `POST /v3/checkouts` (Asaas hosted checkout).
**Status:** Edições aplicadas. NENHUM commit/push/deploy. NENHUMA migration, banco, API key, webhook, preço, PLAN_CATALOG, login, Primeiro Acesso, AccessGrant ou regra de liberação alterados.

---

## 1. Erros reportados pelo Asaas

1. `invalid_object` — "O campo name só pode conter no máximo 30 caracteres."
2. `invalid_object` — "O campo callback deve ser informado."

## 2. Correção do NAME (≤30 caracteres)

O `name` (e o `items[].name`) enviava `Inst Acessor — <plan.name>`, que estourava os 30 caracteres. Agora o `name` usa rótulos curtos e estáveis, derivados do tipo de plano — nunca do texto livre do browser:

| Plano | `name` final | Caracteres | ≤30? |
|---|---|---|---|
| Semanal (ONE_TIME) | `Inst Acessor - Semanal` | 22 | ✓ |
| Mensal (RECURRING, MONTHLY) | `Inst Acessor - Mensal` | 22 | ✓ |
| Anual (RECURRING, YEARLY) | `Inst Acessor - Anual` | 21 | ✓ |

A `description` continua detalhada ("Assinatura anual/mensal Inst Acessor" ou "Acesso de N dias ao Inst Acessor") — não há limite de 30 caracteres para `description`.

## 3. Correção do CALLBACK (3 URLs)

```json
{
  "callback": {
    "successUrl": "<baseUrl>/checkout/retorno?status=sucesso&referencia=<externalReference>",
    "cancelUrl":  "<baseUrl>/checkout/retorno?status=cancelado&referencia=<externalReference>",
    "expiredUrl": "<baseUrl>/checkout/retorno?status=expirado&referencia=<externalReference>"
  }
}
```

- `redirectUrl` (legado) aponta para `successUrl`.
- O `status` é apenas informativo para a UI; a página `/checkout/retorno` lê só `referencia` e NUNCA marca sucesso — a confirmação vem EXCLUSIVAMENTE do webhook.
- **NÃO confundido com webhook**: o webhook (notificação server-to-server que libera o acesso) não foi tocado.

## 4. minutesToExpire

Adicionado `minutesToExpire: 60` (valor conservador, dentro do intervalo aceito 10–1440).

## 5. Preservado (confirmado no código)

- `items: [{ name, description, quantity: 1, value }]` continua presente (valor em REAIS, resolvido no servidor).
- `chargeTypes` — semanal `["DETACHED"]` (avulso); mensal/anual `["RECURRENT"]`.
- `subscription.cycle` — `MONTHLY` (mensal) / `YEARLY` (anual), com `nextDueDate`. Semanal não envia `subscription`.
- `billingTypes`, `dueDate`, `externalReference`, `customerData` (XOR `customer`) inalterados.
- Preço exclusivamente do catálogo server-side (`plan.priceCents / 100`).

## 6. Arquivos alterados

- `src/lib/billing/asaas/types.ts` — `AsaasCheckoutCallback` com as 3 URLs + campo `minutesToExpire?` e `callback?` no `AsaasCheckoutRequest`.
- `src/lib/billing/asaas/hosted-checkout.ts` — `name` encurtado (≤30), 3 URLs de retorno, `minutesToExpire: 60`.
- `src/lib/billing/asaas/client.ts` — log de erro sanitizado ampliado para incluir `errors[].code` e `errors[].description` (sem segredos).
- `src/lib/billing/asaas/index.ts` — export do tipo `AsaasCheckoutCallback`.

## 7. Log seguro

Se o Asaas ainda responder 400, o log passa a registrar apenas: `status`, `code`, e a lista sanitizada `errors[]` com `code` + `description`. NUNCA são logados `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, tokens, cookies ou headers de auth.

## 8. Observação — domínio do callback

O `baseUrl` vem de `getAppBaseUrl()` (SITE_URL → AUTH_URL → NEXTAUTH_URL → VERCEL_URL → localhost). O domínio observado `inst-acessor.vercel.app` vem do fallback `VERCEL_URL`. Em produção, defina `SITE_URL=https://unitrixapp.com.br` no ambiente para que o `callback`/`redirectUrl` use o domínio público correto. **Não** hardcodei novo domínio nem troquei a função de resolução.

---

## Validação pendente (terminal Windows — DONA)

```bash
npx prisma validate
npx tsc --noEmit
npm run build
git status
```
