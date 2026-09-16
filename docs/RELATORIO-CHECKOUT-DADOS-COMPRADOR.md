# Relatório — Dados obrigatórios do comprador no checkout Asaas

**Data:** 2026-09-14
**Escopo:** SOMENTE a coleta e o envio dos dados obrigatórios do comprador que o `POST /v3/checkouts` passou a exigir (`cpfCnpj`, `phoneNumber`, `address`, `addressNumber`, `postalCode`, `province`).
**Status:** Edições aplicadas. NENHUM commit/push/deploy. NENHUMA alteração em API key, webhook, preços, regras de assinatura, liberação de acesso, AccessGrant ou Primeiro Acesso.

---

## 1. Arquivos alterados

- `src/lib/billing/asaas/types.ts` — `AsaasCustomerData` estendido com `phoneNumber`, `address`, `addressNumber`, `postalCode`, `province` (e `cpfCnpj` já existia, agora com comentário de normalização).
- `src/lib/billing/asaas/hosted-checkout.ts` — `buildHostedCheckoutRequest` passa a receber os 6 campos do comprador e os inclui em `customerData` (somente no ramo sem `customer`).
- `src/lib/billing/asaas/checkout-order.ts` — `startPublicCheckout` aceita `buyer` e repassa ao builder.
- `src/app/api/billing/checkout/route.ts` — valida os 6 campos no fluxo anônimo e monta o objeto `buyer` normalizado.
- `src/lib/validators/billing.ts` — `publicCheckoutSchema` aceita os novos campos e normaliza (CPF/CNPJ e CEP → só dígitos; telefone → E.164 com prefixo 55).
- `src/app/checkout/checkout-form.tsx` — novos campos no formulário (somente Cenário B) com máscaras de exibição.

## 2. Campos adicionados ao checkout

Nome, E-mail, CPF/CNPJ, Telefone/WhatsApp, CEP, Endereço, Número, Bairro — exatamente os dados digitados pelo comprador. Nenhum valor fixo/inventado. O endereço e o bairro são preenchidos manualmente (não há infraestrutura de consulta de CEP no projeto; não foi adicionada dependência).

Layout premium e compacto: `CPF/CNPJ | Telefone` em grade, `CEP` em linha cheia, `Endereço | Número` em grade (número em coluna estreita), `Bairro` em linha cheia. No mobile tudo empilha. Card do plano, aviso amarelo, botão gradiente, textos de segurança e identidade visual preservados.

## 3. Payload final de customerData (placeholders — sem dados reais)

```json
{
  "customerData": {
    "name": "<NOME DO COMPRADOR>",
    "email": "<email@exemplo.com>",
    "cpfCnpj": "<somente dígitos, ex. 00000000000>",
    "phone": "<DDD+número, ex. 11999999999>",
    "address": "<rua/avenida, sem número>",
    "addressNumber": "<número>",
    "postalCode": "<somente dígitos, 8 caracteres>",
    "province": "<bairro>"
  }
}
```

Esse objeto substitui o antigo `customerData` apenas quando **não** existe `asaasCustomerId` válido. Se o comprador já tem `customer`, o fluxo atual continua enviando `customer: "<id>"` e NÃO envia `customerData` (XOR preservado).

## 4. Validações implementadas

- **Servidor (`route.ts`):** no fluxo anônimo, exige não-vazio para CPF/CNPJ, telefone, CEP, endereço, número e bairro. Devolve 400 com mensagem clara apontando o campo ausente. E-mail continua validado por Zod (`email()`). Plano e preço permanecem resolvidos no servidor.
- **Schema (`billing.ts`):** normaliza apenas para a API — CPF/CNPJ e CEP viram só dígitos; telefone vira DDD + número, somente dígitos (SEM prefixo internacional 55, formato do `POST /v3/checkouts`). Não altera o que é exibido ao usuário.
- **Front (`checkout-form.tsx`):** validação espelhada de preenchimento antes do fetch (feedback imediato); máscaras só na exibição.

## 5. Dados pessoais em log

Nenhum dado pessoal é logado. CPF/CNPJ, telefone e endereço **não** aparecem em `console.log`, mensagens de erro, nem no `externalReference` (que continua sendo derivado só do e-mail + UUID). O log sanitizado do Asaas (`client.ts`) permanece limitado a `status`, `code` e `errors[].code/description`.

## 6. Domínio (produção)

A variável que controla o domínio público é **`SITE_URL`** (ordem em `getAppBaseUrl()`: `SITE_URL` → `AUTH_URL` → `NEXTAUTH_URL` → `VERCEL_URL` → localhost). O payload ainda mostra `inst-acessor.vercel.app` porque o ambiente não tem `SITE_URL` definido e cai no fallback `VERCEL_URL`.

**O que configurar na Vercel (produção):**
```
SITE_URL=https://unitrixapp.com.br
```

Isso faz `callback`/`redirectUrl` usarem `https://unitrixapp.com.br/checkout/retorno...`. Nenhum hardcode foi feito.

## 7. Pendências

- Definir `SITE_URL` na Vercel (item 6).
- Validação local (terminal Windows): `npx tsc --noEmit`, `npm run build`, `npx prisma validate`, `git status`.
- Confirmar com um POST real que o Asaas aceita os novos campos de endereço (nenhuma chamada real foi feita nesta sessão).
