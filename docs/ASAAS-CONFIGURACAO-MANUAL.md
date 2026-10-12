# Asaas — Configuração Manual (Webhook + Variáveis de Ambiente)

> **Este documento é um ROTEIRO MANUAL.** O webhook **NÃO está declarado como concluído**.
> Nenhuma automação, script ou deploy faz isto por você. As etapas abaixo precisam ser
> executadas à mão pela DONA no painel do Asaas e na Vercel.

---

## 0. O que já está pronto no código (não precisa mexer)

- O endpoint do webhook existe: `src/app/api/webhooks/asaas/route.ts` (`POST`).
- Ele é **fail-closed**: sem `ASAAS_WEBHOOK_TOKEN` configurado responde **503** e não
  processa nada; com token errado responde **403**.
- A comparação do token é **constant-time** (`timingSafeEqual`) e lê o token **somente**
  do header `asaas-access-token` — nunca de query string.
- Idempotência por `BillingEvent.eventId` (`@unique`): reenvio do mesmo evento não
  duplica acesso.
- A liberação de acesso ocorre **apenas** por `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`
  validados. `CHECKOUT_PAID` **não** libera acesso (só auditoria).

Falta apenas **registrar o webhook no painel do Asaas** e **garantir as variáveis de
ambiente**. É o que este documento descreve.

---

## 1. URL EXATA a registrar no Asaas

No painel do Asaas → **Integrações → Webhooks** (ou "Notificações"), cadastre:

```
https://unitrixapp.com.br/api/webhooks/asaas
```

Notas:
- Use **exatamente** este caminho (`/api/webhooks/asaas`), com `POST`.
- Se você estiver testando em um domínio de preview da Vercel, troque o host pelo
  domínio do deploy (ex.: `https://<seu-preview>.vercel.app/api/webhooks/asaas`).
- **NÃO** cadastre `https://inst-acessor.vercel.app/api/webhooks/asaas` como produção —
  esse domínio é técnico e não é o domínio público oficial.

---

## 2. EVENTOS EXATOS a habilitar

Habilite **estes** eventos (são os que o código reconhece e trata — lista fechada em
`src/lib/billing/asaas/types.ts`, `ASAAS_KNOWN_EVENTS`). Qualquer evento fora desta
lista é **rejeitado com 400** pelo parser.

### Pagamento (essenciais — sem eles não há liberação de acesso)
- `PAYMENT_CONFIRMED`  → libera/renova acesso
- `PAYMENT_RECEIVED`   → libera/renova acesso
- `PAYMENT_OVERDUE`    → marca assinatura como `PAST_DUE` (não revoga período pago)
- `PAYMENT_CANCELED`   → cancela ordem ainda não paga
- `PAYMENT_REFUNDED`   → **revoga** o acesso da cobrança estornada

### Assinatura (recorrência mensal/anual)
- `SUBSCRIPTION_CREATED`
- `SUBSCRIPTION_UPDATED`
- `SUBSCRIPTION_INACTIVATED`
- `SUBSCRIPTION_DELETED`

### Checkout
- `CHECKOUT_PAID`  → **só auditoria** (reconcilia o status da ordem; NÃO libera acesso)

> `PAYMENT_CREATED` está na lista de eventos conhecidos, mas **não** altera acesso.
> Habilitá-lo é opcional.

---

## 3. Regras do TOKEN de autenticação do webhook

O Asaas autentica o webhook por **token compartilhado** (não por HMAC de payload).

1. No painel do Asaas, no cadastro do webhook, defina o campo **"Token de autenticação"**.
2. O mesmo valor **exato** precisa estar em `ASAAS_WEBHOOK_TOKEN` na Vercel.
3. Requisitos de formato (validados por `asaasWebhookTokenIssue()` em
   `src/lib/billing/asaas/config.ts`):
   - **32 a 255 caracteres**
   - **sem espaços**
   - **diferente da API Key** (`ASAAS_API_KEY`) — o token do webhook NÃO é a API key.
4. O Asaas envia esse valor no header **`asaas-access-token`**. É o único header aceito.
   Não cadastre autenticação por query string (`?token=...`): o código ignora.
5. Gere o token como um valor aleatório (ex.: 48+ caracteres aleatórios). Não reutilize
   a API key.

---

## 4. Como confirmar Sandbox vs Produção

> **A variável `ASAAS_ENV` na Vercel é um Secret e o valor ATUAL é DESCONHECIDO.**
> Este documento **não afirma** qual ambiente está ativo. Confirme pelos sinais abaixo.

O código escolhe a URL base assim (`src/lib/billing/asaas/config.ts`):
- `ASAAS_BASE_URL` presente → usa esse valor, ponto.
- Sem `ASAAS_BASE_URL` → `ASAAS_ENV === "production"` (ou `"prod"`) usa
  `https://api.asaas.com/v3`; qualquer outro valor (ou ausente) usa
  `https://api-sandbox.asaas.com/v3` (Sandbox é o default).

### Como conferir, sem expor o valor
1. Abra o painel admin → **Assinaturas** (`/admin/assinaturas`). O card
   "Integração de pagamento" mostra o rótulo **Ambiente** ("Sandbox" ou "Produção").
   Esse rótulo é derivado de `ASAAS_ENV`/`ASAAS_BASE_URL` **sem revelar o valor**.
2. Confira no painel do Asaas se a API key configurada em `ASAAS_API_KEY` é da conta
   **Sandbox** ou **Produção**, e se o **webhook foi cadastrado na mesma conta**.
3. **A API key e o webhook têm de ser do MESMO ambiente.** Uma chave de produção com um
   webhook cadastrado no sandbox (ou vice-versa) significa que nenhum evento chegará.

> **AVISO:** não use produção como ambiente de teste. Não gere cobranças reais para
> validar. Se estiver validando, faça-o com credenciais e conta de **Sandbox**.

---

## 5. Variáveis de ambiente na Vercel

Configure em **Vercel → Project → Settings → Environment Variables** (marque o ambiente
correto: Production e/ou Preview):

| Variável | Obrigatória | Valor esperado |
|---|---|---|
| `ASAAS_API_KEY` | Sim (para cobrar) | Chave de API do Asaas (`access_token`). **Secret.** |
| `ASAAS_WEBHOOK_TOKEN` | **Sim** (para liberar acesso) | Token de 32–255 chars, sem espaços, ≠ API key. **Secret.** O mesmo valor do painel do Asaas. |
| `ASAAS_ENV` | Recomendada | `production` para produção; `sandbox` (ou ausente) para testes. **Confirme antes de assumir.** |
| `ASAAS_BASE_URL` | Opcional | Só se quiser forçar a URL base. Vazio = derivado de `ASAAS_ENV`. |
| `ASAAS_BILLING_TYPE` | Opcional | `PIX` (default) \| `BOLETO` \| `CREDIT_CARD`. |
| `SITE_URL` (ou `AUTH_URL`/`NEXTAUTH_URL`) | Recomendada | `https://unitrixapp.com.br` — usado nos links de retorno e de ativação. |

Regras:
- **Nunca** crie `NEXT_PUBLIC_ASAAS_*`: a chave e o token são server-only.
- Após alterar qualquer variável, faça um **novo deploy** para que o runtime a leia.

---

## 6. Checklist de verificação (manual)

- [ ] Webhook cadastrado em `https://unitrixapp.com.br/api/webhooks/asaas` (POST).
- [ ] Os eventos da seção 2 habilitados.
- [ ] Token "de autenticação" do webhook definido no Asaas (32–255 chars, sem espaços).
- [ ] `ASAAS_WEBHOOK_TOKEN` na Vercel = **exatamente** o mesmo valor.
- [ ] `ASAAS_API_KEY` e o webhook são do **mesmo ambiente**.
- [ ] `ASAAS_ENV` confirmado (não presumido).
- [ ] `/admin/assinaturas` mostra **Webhook: Configurado** e o ambiente esperado.
- [ ] Um evento de teste no **Sandbox** libera acesso (grant/assinatura) e o evento
      aparece registrado (idempotente: um reenvio do mesmo evento **não** duplica).

> Enquanto o webhook não estiver registrado e o token alinhado, o acesso **não** será
> liberado automaticamente — o checkout ainda abre, mas o pagamento não gera acesso.

---

## 7. AMBIENTE DE TESTES (Sandbox) — preparação

> Objetivo: validar o fluxo de ponta a ponta **sem cobrar ninguém de verdade**.
> Nenhum passo aqui foi executado automaticamente. Nenhuma credencial é exibida.

### 7.1. Por que um ambiente separado

O Asaas tem duas bases independentes:

| Ambiente   | URL base da API                    | Painel                    |
|------------|------------------------------------|---------------------------|
| Sandbox    | `https://api-sandbox.asaas.com/v3` | sandbox.asaas.com         |
| Produção   | `https://api.asaas.com/v3`         | asaas.com                 |

Uma chave de **sandbox** só funciona no sandbox e vice-versa. Se a chave e a URL
não pertencerem ao mesmo ambiente, o checkout falha com erro de autenticação.

⚠️ **`ASAAS_ENV` está definido na Vercel como Secret e o valor atual é
DESCONHECIDO.** Não presuma. Confirme pelo painel `/admin/assinaturas`, que
mostra o ambiente resolvido sem revelar a chave.

### 7.2. Regra de ouro: nunca apontar o Sandbox para a produção

O webhook do Sandbox **Não deve** ser cadastrado em:

- `https://unitrixapp.com.br/api/webhooks/asaas`
- `https://inst-acessor.vercel.app/api/webhooks/asaas`

(os dois endereços podem apontar para a MESMA implantação de produção — não se
presuma que `inst-acessor.vercel.app` é staging.)

Cadastre o webhook do Sandbox **somente** em um endereço de Preview dedicado,
que precisa usar o **banco staging** (Neon `staging-inst-acessor`), nunca o
banco de produção. Misturar os dois libera acesso real a partir de um pagamento
falso.

### 7.3. Passo a passo (manual, na ordem)

1. **Banco** — garanta que o ambiente de Preview que receberá os testes usa a
   connection string da branch `staging-inst-acessor` (nunca a de produção).
2. **Preview na Vercel** — crie um ambiente de Preview (ou use um já existente)
   destinado a testes. **Não altere o ambiente de Produção.**
3. **Chave de sandbox** — no painel do Asaas **Sandbox** → Integrações → Chave
   de API, gere uma chave nova (nunca reaproveite a de produção).
4. **Variáveis no ambiente de Preview** (nunca em Production):
   - `ASAAS_API_KEY`     = chave gerada no passo 3
   - `ASAAS_ENV`         = `sandbox`
   - `ASAAS_BASE_URL`    = (deixe em branco — o padrão do sandbox já é correto)
   - `ASAAS_WEBHOOK_TOKEN` = token de 32–255 caracteres, **sem espaços** e
     **diferente** da API Key
   - `ASAAS_BILLING_TYPE` = `PIX` (ou `CREDIT_CARD` para testar cartão)
   - `SITE_URL`          = a URL do Preview (usada no retorno do checkout)
5. **Webhook no painel Sandbox** → Integrações → Webhooks:
   - Nome: `Inst Acessor — Sandbox`
   - URL: `https://<SEU-PREVIEW>/api/webhooks/asaas` (o Preview do passo 2)
   - Versão da API: **v3** (a que o código usa)
   - Tipo de envio: **POST**, JSON
   - Token de autenticação: **exatamente** o valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: os mesmos listados na seção 2 deste documento
   - E-mail de alertas: um e-mail que você acompanhe
6. **Publicação do Preview** — publique/redeploy apenas o ambiente de Preview.

### 7.4. Como comprovar que o webhook realmente recebe eventos

Não basta o painel dizer "configurado" — isso não prova entrega. Para provar:

1. No Asaas Sandbox, use o **simulador de eventos** (ou crie uma cobrança de
   teste no sandbox e pague-a no ambiente de simulação).
2. Confira em `/admin/webhooks` que o evento chegou e foi processado.
3. Confira em `/admin/assinaturas` que:
   - a assinatura correspondente ficou **ACTIVE**, e
   - o `Payment` correspondente foi registrado como pago.
4. Para o estorno: simule `PAYMENT_REFUNDED` e confirme que o acesso foi
   **revogado** (implementado em `src/lib/billing/asaas/events.ts`).

Se o evento não chegar: confirme a URL (sem barra final), o token (idêntico nos
dois lados) e se o ambiente do painel é o mesmo da chave.

### 7.5. O que continua exigindo ação manual do proprietário

- Criar/publishar o ambiente de Preview com o banco staging.
- Gerar a chave de sandbox e cadastrar as variáveis **no Preview**.
- Cadastrar o webhook de sandbox com o token correto.
- Confirmar, pelo simulador, que os eventos chegam e liberam acesso.
- **Decidir** quando (e se) promover o `ASAAS_ENV` de produção.

Nada disso foi feito automaticamente: exigiria credenciais e alteração de
ambiente, ambos fora do escopo autorizado.

---

## 8. AMBIENTE DE PREVIEW DEDICADO (isolamento total de produção)

> **Roteiro MANUAL.** Nenhuma etapa é executada por automação. Nenhuma
> credencial é criada nem exibida aqui. **A URL do Preview é um PLACEHOLDER —
> NÃO invente o endereço.** Ele só pode ser preenchido depois que o proprietário
> confirmar o endereço real do deploy de Preview.

### 8.1. Princípio

Um ambiente **separado** de produção, onde:

- o **banco** é a branch Neon `staging-inst-acessor` (nunca produção);
- a **chave** é de **Sandbox** do Asaas (nunca a de produção);
- o **webhook** é cadastrado no painel **Sandbox** e aponta para ESTE Preview;
- as **variáveis** vivem apenas no escopo **Preview** da Vercel.

Regra de ouro: **um pagamento falso nunca pode liberar acesso real.** Isso só é
garantido se banco (staging) + chave (sandbox) + webhook (sandbox) estiverem no
MESMO ambiente isolado — nunca misturados com produção.

### 8.2. Pré-requisitos (confirmar SEM presumir)

- [ ] A branch `staging-inst-acessor` existe no Neon e já tem as migrations aplicadas.
- [ ] Você tem acesso ao painel **sandbox.asaas.com** (conta Sandbox, separada da de produção).
- [ ] Você tem acesso a Vercel → Project → Settings → Environment Variables.

### 8.3. Passo a passo (manual, na ordem)

1. **Banco (Neon staging).**
   - Painel Neon → branch `staging-inst-acessor` → copie a connection string **com pooler**.
   - Confirme o HOST **sem expor a credencial**: ele **NÃO** pode conter
     `ep-autumn-sky` (host de **produção**) e deve começar com
     `ep-patient-brook-acffelj3` (host da staging atual — confira, pois o host
     pode mudar se a branch for recriada).
   - Nunca use a string de produção no Preview.

2. **Chave de API de Sandbox.**
   - Painel Sandbox → Integrações → Chave de API → gere uma chave **NOVA**.
   - **Não** reaproveite a chave de produção.

3. **Token do webhook.**
   - Gere um valor aleatório de **32–255 caracteres**, **sem espaços**, e
     **diferente** da API key (regras da seção 3).

4. **Ambiente de Preview na Vercel.**
   - Use o ambiente **Preview** (branches de preview). **Não altere Production.**
   - Defina as variáveis do passo 5 **apenas no escopo Preview**.

5. **Variáveis de ambiente (escopo: Preview) — lista EXATA de nomes.**

   | Variável | Valor | Notas |
   |---|---|---|
   | `DATABASE_URL`  | connection string da branch **staging** | Nunca a de produção. Pooler. |
   | `DIRECT_URL`    | connection string direta da **staging**   | Usado por migrations/Prisma. |
   | `ASAAS_API_KEY` | chave **Sandbox** (passo 2)               | **Secret.** Nunca a de produção. |
   | `ASAAS_ENV`     | `sandbox`                                  | Explícito, para não depender do default. |
   | `ASAAS_BASE_URL`| *(deixe EM BRANCO)*                        | O padrão do sandbox já é correto. |
   | `ASAAS_WEBHOOK_TOKEN` | token do passo 3                     | **Secret.** O MESMO valor do painel Sandbox. |
   | `ASAAS_BILLING_TYPE` | `PIX` (ou `CREDIT_CARD`)              | Meio de cobrança aceito no checkout. |
   | `SITE_URL`      | `https://<PREVIEW_URL>`                    | **PLACEHOLDER.** Usado nos retornos do checkout. |
   | `AUTH_URL` / `NEXTAUTH_URL` | `https://<PREVIEW_URL>`         | Mesmo endereço, para o login/next-auth. |
   | `AUTH_SECRET`   | segredo **próprio do Preview**             | **Secret.** O app não sobe sem ele. Nunca o de produção. |

   > **NÃO** crie `NEXT_PUBLIC_ASAAS_*`: a chave e o token são server-only.
   > Qualquer `?token=`/`NEXT_PUBLIC_` que exponha segredo é proibido.

6. **Webhook no painel Sandbox → Integrações → Webhooks.**
   - Nome: `Inst Acessor — Sandbox`
   - URL: `https://<PREVIEW_URL>/api/webhooks/asaas`
     - **PLACEHOLDER — preencher SOMENTE após o proprietário confirmar a URL
       real do Preview.** Não invente o host, não presuma que
       `inst-acessor.vercel.app` é staging (ele é produção).
   - Versão da API: **v3** · Tipo: **POST**, JSON
   - Token de autenticação: **exatamente** o valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: os mesmos da seção 2 deste documento
   - E-mail de alertas: um que você acompanhe

7. **Publicar o Preview** (redeploy apenas do escopo Preview).

### 8.4. Como confirmar Sandbox vs Produção (sem revelar valores)

1. Painel admin → **`/admin/assinaturas`** → card "Integração de pagamento" mostra o
   rótulo **Ambiente** ("Sandbox" ou "Produção"), derivado de `ASAAS_ENV`/`ASAAS_BASE_URL`.
2. Confirme no painel do Asaas se a API key do passo 2 é da conta **Sandbox** e se
   o **webhook foi cadastrado na mesma conta Sandbox**.
3. **Chave e webhook têm de ser do MESMO ambiente.** Chave de produção + webhook
   sandbox (ou vice-versa) = nenhum evento chega.
4. Confirme o host do `DATABASE_URL` do Preview: **não** pode ser `ep-autumn-sky`.

### 8.5. Como PROVAR que o evento realmente chegou

O painel dizer "configurado" **não prova entrega**. Para provar:

1. No Sandbox, use o **simulador de eventos** (ou crie/pague uma cobrança de teste
   no ambiente de simulação).
2. Confira em **`/admin/webhooks`** (ou `/admin/assinaturas`) que o evento chegou,
   com `type` = `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` e `processed = true`.
3. Confira em **`/admin/assinaturas`** que a assinatura correspondente ficou
   **ACTIVE** e que o `Payment` foi registrado como pago.
4. **Idempotência:** reenvie o MESMO evento → **não** pode duplicar acesso.
5. **Estorno:** simule `PAYMENT_REFUNDED` → o acesso da cobrança estornada deve
   ser **revogado**.
6. Se nada chegar: confira a URL (sem barra final), o token (idêntico nos dois
   lados) e se o ambiente do painel é o mesmo da chave.

### 8.6. Testes OFFLINE (sem rede, sem banco, sem cobrança)

Há uma suíte simulada que exercita as funções REAIS dos módulos de cobrança
(preço no servidor, os 6 planos, promoção por nº de cobranças, parser do webhook,
valores legítimos, autenticação da rota do webhook, capacidade):

```
node --import ./bench/register-asaas-tests.mjs bench/test-asaas-flows.mjs
```

- **Trava de banco:** `bench/asaas-test-env.mjs` aponta o `DATABASE_URL` para um
  host inalcançável, para que NENHUM caminho toque um banco real. Isso existe
  por um motivo concreto: o `@prisma/client` carrega **automaticamente** o
  arquivo `.env` (que neste projeto aponta para **PRODUÇÃO**) quando
  `DATABASE_URL` não está definido, e o Node **não** carrega `.env.local` sozinho.
  Sem a trava, um teste que chegasse ao banco gravaria em **produção**.
- Os cenários que exigem banco ou a Sandbox do Asaas aparecem no relatório do
  teste como `[REQUER DB]` / `[REQUER SANDBOX]` — nunca como "passou".

### 8.7. O que continua exigindo ação manual do proprietário

- Criar/publicar o ambiente de Preview com o banco **staging**.
- Gerar a chave de Sandbox e cadastrar as variáveis **no escopo Preview**.
- Cadastrar o webhook de Sandbox com o token correto e a **URL real do Preview**
  (preencher o placeholder `https://<PREVIEW_URL>/api/webhooks/asaas`).
- Confirmar, pelo simulador, que os eventos chegam e liberam acesso.
- **Decidir** quando (e se) promover qualquer coisa para produção.

Nada disso foi feito automaticamente: exigiria credenciais e alteração de
ambiente, ambos fora do escopo autorizado.

---

## 9. DEFEITO LATENTE REGISTRADO (webhook × indisponibilidade do banco)

Durante os testes offline foi observado um defeito **latente** em
`src/lib/billing/asaas/events.ts`, no primeiro `catch` de `handleAsaasEvent`:

- Se `billingEvent.create` **falhar porque o banco está fora**, o `catch` chama
  `billingEvent.findUnique` **sem `try/catch`**. Se essa segunda chamada também
  falhar (mesma indisponibilidade), o erro **escapa** de `handleAsaasEvent` e a
  rota `POST /api/webhooks/asaas` **lança** em vez de responder o **500 explícito**
  documentado (regra 13: "falha ao aplicar → 5xx para o Asaas reenviar").
- Impacto: durante uma queda do banco, o Asaas pode receber um erro genérico em
  vez do 500 limpo. O evento continua **reprocessável** (o Asaas reenvia em
  qualquer erro 5xx), mas o contrato de resposta explícito não é cumprido.
- **Não foi corrigido nesta rodada:** alterar o processamento de webhook (área
  sensível de pagamento) exige decisão do proprietário. Correção sugerida:
  envolver o `findUnique` de fallback num `try/catch` que **retorna
  `{ duplicate:false, failed:true }`** quando ele também falhar.
