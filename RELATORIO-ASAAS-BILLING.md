# RELATÓRIO — ASAAS BILLING (FECHAMENTO NO CÓDIGO)

**Data:** 2026-08-30
**Branch:** `checkpoint-fase8-fase9` (não alterada)
**HEAD:** preservado (nenhum commit nesta rodada)
**Escopo:** Fechar o billing Asaas no código — cliente server-side, planos R$ 27/77/497, customer, checkout, webhook idempotente, liberação de acesso, área `/assinatura`, Admin `/admin/assinaturas`, liberação manual pelo ADMIN, webhook TikTok com validação de assinatura, testes e documentação.
**Status:** Concluído · `tsc --noEmit` EXIT 0 · billing 31/31 · growth 28/28 · build/prisma bloqueados no sandbox (403/SWC — DONA roda local)

---

## 1. Estado final

O billing Asaas está **implementado e fechado no código**, com toda a integração real funcionando por camadas:

- **Fonte de verdade dos preços:** catálogo imutável server-side (`src/lib/billing/plans/catalog.ts`) → Semanal **R$ 27,00** (2700), Mensal **R$ 77,00** (7700), Anual **R$ 497,00** (49700). O client envia apenas `planId`; preço/duração/ciclo são resolvidos **sempre no servidor**.
- **Gateway:** cliente HTTP Asaas v3 (`src/lib/billing/asaas/client.ts`) com `access_token`, timeout 15s, erros tipados e sanitização de payload.
- **Checkout real:** ONE_TIME → `POST /payments` (semanal); RECURRING → `POST /subscriptions` (mensal/anual). Persistência local em **PENDING** — criar checkout **não** libera acesso.
- **Liberação de acesso:** somente o **webhook** com evento de pagamento confirmado (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`) ativa a assinatura (`ACTIVE` + `startAt`/`paidAt`/`expiresAt`).
- **Liberação manual pelo ADMIN:** sem cobrança, sem Asaas, com origem `ADMIN_MANUAL` distinguível de `ASAAS` (nova regra da DONA).
- **Testes:** suíte determinística `npm run billing:test` (31 testes) + `npm run growth:test` (28 testes).

## 2. Arquivos criados

| Arquivo | Papel |
|---|---|
| `src/lib/billing/plans/catalog.ts` | Catálogo oficial imutável dos 3 planos (fonte de preços). |
| `src/lib/billing/asaas/config.ts` | Configuração server-only (env → sandbox/produção, tipos de cobrança). |
| `src/lib/billing/asaas/client.ts` | Cliente HTTP Asaas (fetch, timeout, sanitize, erros tipados). |
| `src/lib/billing/asaas/types.ts` | Tipos Asaas (customer/payment/subscription, eventos conhecidos). |
| `src/lib/billing/asaas/webhook.ts` | Parser de webhook (eventId determinístico, referências externas). |
| `src/lib/billing/asaas/events.ts` | Processador de eventos (claim-first idempotente, owner por ref externa). |
| `src/lib/billing/asaas/service.ts` | Serviço de negócio (customer + checkout real + cancelamento). |
| `src/lib/billing/manual-access-core.ts` | Núcleo puro da liberação manual (sem banco, testável). |
| `src/lib/billing/manual-access.ts` | Serviço da liberação manual (grantManualAccess). |
| `src/app/api/webhooks/asaas/route.ts` | Webhook Asaas (token, rate limit, idempotência). |
| `src/app/api/billing/checkout/route.ts` | POST /api/billing/checkout (owner + Zod + plano server-side). |
| `src/app/api/admin/access-grant/route.ts` | POST /api/admin/access-grant (somente ADMIN). |
| `src/components/admin/admin-access-grant.tsx` | Formulário client de liberação manual (7/30/90/personalizado). |
| `src/components/billing/assinatura-client.tsx` | UI client da página /assinatura (planos, checkout, estado). |
| `src/app/admin/assinaturas/page.tsx` | Painel Admin de assinaturas/pagamentos + coluna Origem. |
| `scripts/billing-tests.ts` | Suíte de testes determinísticos (31 testes). |
| `tsconfig.billing-test.json` | Build de testes billing (espelha growth-test). |

## 3. Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `prisma/schema.prisma` | Subscription: `accessSource`, `grantedByAdminId` (+ campos externos/amount da rodada anterior); Payment: `eventType`/`eventId`; model `BillingEvent`; User: `asaasCustomerId`. |
| `src/types/prisma-shim.d.ts` | Espelha os campos novos para type-check no sandbox. |
| `src/lib/billing/db.ts` | Repository `bll` com delegates (plan/subscription/payment/billingEvent/user). |
| `src/lib/billing/index.ts` | Barrel público + exports de `manual-access` e `manual-access-core`. |
| `src/lib/billing/subscriptions/index.ts` | `SubscriptionView`/`SubscriptionRow`/`toSubscriptionView` com `accessSource`. |
| `src/lib/billing/checkout.ts` | `startCheckout` (resolução server-side + adapter). |
| `src/lib/billing/provider/index.ts` | Seletor de adapter (Asaas se configurado, senão `notConfigured`). |
| `src/lib/billing/provider/types.ts` | Tipos da abstração (`CreateCheckoutInput/Result`, `BillingRecordResult`). |
| `src/lib/billing/adapters/asaas.ts` | Adapter do gateway (fail-closed sem chave). |
| `src/lib/validators/admin.ts` | `adminGrantAccessSchema` (email + days 1..3650). |
| `src/lib/validators/billing.ts` | `checkoutStartSchema` (planId). |
| `src/app/admin/usuarios/page.tsx` | Inclui `<AdminAccessGrant />`. |
| `src/app/admin/integracoes/page.tsx` | Descrição Asaas atualizada (integração ativa quando chave definida). |
| `src/app/api/webhooks/tiktok/route.ts` | **POST com validação de assinatura `X-Signature` (fail-closed).** |
| `.env.example` | Seção Asaas atualizada (API key, base URL, env, billing type, webhook token). |
| `package.json` | Script `billing:test`. |
| `tsconfig.billing-test.json` | Inclui `manual-access-core.ts`. |

## 4. Models/enums/fields Prisma

- **Subscription**: `status` (PENDING/ACTIVE/EXPIRED/CANCELED/PAST_DUE), `billingType` (ONE_TIME/RECURRING), `billingInterval` (MONTH/YEAR), `provider` ("asaas"/"manual"), `externalCustomerId`, `externalSubscriptionId`, `externalPaymentId`, `amountCents`, `currency`, `paidAt`, `idempotencyKey`, **`accessSource`** ("ASAAS"/"ADMIN_MANUAL"), **`grantedByAdminId`**, `startAt`, `expiresAt`, `nextBillingAt`, `canceledAt`, `autoRenew`. `@@unique([idempotencyKey])`, índices em `externalSubscriptionId`, `[userId,status]`, `[userId,expiresAt]`.
- **Payment**: `status`, `provider`, `externalPaymentId`, `paidAt`, `eventType`, `eventId` (`@@unique`), índices.
- **BillingEvent**: `eventId` (`@unique`, idempotência), `provider`, `type`, `userId?`, `subscriptionId?`, `payload Json?` (sanitizado), `processed`.
- **User**: `asaasCustomerId String? @unique`.
- **SystemSetting**: chave-valor (ex.: IA) — já existia.
- **Enums**: os status são strings no schema (padrão do projeto); os enums lógicos vivem em `types.ts`/`SUBSCRIPTION_STATUSES`.

## 5. Cliente Asaas

`src/lib/billing/asaas/client.ts` — camada fina sobre `fetch`:

- Headers: `access_token` (só server-side), `Content-Type: application/json`, `User-Agent: InstAcessor/1.0`.
- Timeout de 15s (`AbortController`); erro `AsaasHttpError` tipado (status, código, mensagens sanitizadas).
- `AsaasNotConfiguredError` lançado quando não há chave (fail-closed).
- `sanitizeAsaasPayload` remove `token|secret|password|access_|apikey|api_key|authorization` em profundidade — **nunca loga credenciais**.

## 6. Checkout semanal

Semanal (ONE_TIME, R$ 27,00, 7 dias): `startAsaasCheckout` → `POST /payments` com `customer`, `billingType`, `value: 27`, `dueDate` hoje, `externalReference: instacessor:<userId>:semanal`. Devolve `invoiceUrl`/`bankSlipUrl`/`pixQrCodeUrl`/`pixCopiaECola` como `checkoutUrl`. Local: Subscription **PENDING** com `externalPaymentId`, `amountCents: 2700`, `expiresAt = now+7d` (não usa `startAt` até confirmação).

## 7. Checkout mensal

Mensal (RECURRING, R$ 77,00, 30 dias): `POST /subscriptions` com `cycle: MONTHLY`, `nextDueDate` hoje. Local: Subscription **PENDING**, `autoRenew: true`, `nextBillingAt = +1 mês`, `externalSubscriptionId` persistido, sem `expiresAt` até confirmação.

## 8. Checkout anual

Anual (RECURRING, R$ 497,00, 365 dias): `POST /subscriptions` com `cycle: YEARLY`. Local: **PENDING**, `autoRenew: true`, `nextBillingAt = +1 ano`, `externalSubscriptionId`. Sem `expiresAt` até confirmação.

## 9. Customer

`ensureAsaasCustomer`: busca `User.asaasCustomerId`; se ausente, `POST /customers` com nome (limitado a 100 chars) e e-mail da **sessão autenticada**; persiste apenas o ID externo no `User`. Nunca duplica customer por usuário.

## 10. Webhook

`POST /api/webhooks/asaas`:

- **Fail-closed:** sem `ASAAS_WEBHOOK_TOKEN` → 503 (não aceita nada).
- **Token:** header `asaas-access-token` (oficial), depois `Authorization: Bearer`, depois `?token=`. Comparação `timingSafeEqual` → 403.
- **Rate limit** por IP.
- **Parser:** aceita somente eventos em `ASAAS_KNOWN_EVENTS`; `eventId` determinístico (`<evento>:<id externo>`); rejeita payload sem referência estável.
- **Idempotência:** claim-first via `BillingEvent.eventId` único — replay não reprocessa.
- **Owner:** nunca confia em `userId` do payload — localiza por `externalSubscriptionId`/`externalPaymentId`/`externalCustomerId` no banco.

## 11. Idempotência

Dupla proteção: (1) rota checa `bll.billingEvent.findUnique({ eventId })` → retorna `duplicate` sem reprocessar; (2) `handleAsaasEvent` cria o `BillingEvent` **antes** de aplicar (unique constraint é o "lock" contra concorrência/replay). Payload persistido sempre sanitizado.

## 12. Regras de ativação de acesso

- **Checkout ≠ aprovado:** Subscription nasce `PENDING`, `startAt`/`paidAt`/`expiresAt` nulos.
- **Pagamento confirmado** (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`) → `status: ACTIVE`, `startAt = paidAt`, `expiresAt = startAt + durationDays`, `paidAt` preenchido, `nextBillingAt` recalculado; cria/atualiza `Payment` PAID.
- **`PAYMENT_OVERDUE`** → `PAST_DUE` (não bloqueia acesso atual).
- **`PAYMENT_CANCELED`** → `PENDING` (se nunca pago).
- **`PAYMENT_REFUNDED`** → `CANCELED` + `expiresAt: now` (revoga acesso).
- **`SUBSCRIPTION_INACTIVATED`/`SUBSCRIPTION_DELETED`** → `autoRenew: false`.
- Estados de acesso na UI: sem assinatura / aguardando pagamento (PENDING) / ativa (ACTIVE) / vencida (EXPIRED) / cancelada (CANCELED) / em atraso (PAST_DUE).

## 13. Liberação manual por ADMIN (NOVA REGRA)

`src/lib/billing/manual-access.ts` — `grantManualAccess({ email, days, adminId })`:

- **Autorização:** `requireAdminSession()` no servidor (nunca confia em role do frontend).
- **E-mail sem conta → não cria usuário com senha falsa.** Retorna `USER_NOT_FOUND` (404) — a criação/convite fica para a fase futura de "primeiro acesso".
- **Sem Asaas:** não chama a API, não altera dados de pagamento (não finge compra).
- **Origem distinguível:** `provider = "manual"`, `accessSource = "ADMIN_MANUAL"` (vs `asaas`/`ASAAS`).
- **Extensão previsível:** se já existe acesso manual ativo, novo vencimento = `max(vencimento atual, agora) + dias` (`computeExtendedExpiry`).
- **Plano de referência:** âncora por duração (`resolveAnchorPlanSlug`: ≤7 semanal, ≤45 mensal, senão anual) — apenas vínculo FK; fonte de verdade da duração é `expiresAt`.
- **Auditoria mínima:** registra `grantedByAdminId`, `startAt`, `expiresAt`, `accessSource`. Não apaga histórico de pagamentos.
- **Duração:** inteiro 1..3650 dias (validador + schema Zod).
- **Rate limit:** 20 req/min por admin.

## 14. Segurança do Admin único

- `requireAdminSession` (guard.ts) consulta o **banco** (`role === "ADMIN"` + `status === "ACTIVE"`) — fonte da verdade, não a UI.
- `/api/admin/access-grant`: guard server-side + rate limit + Zod.
- `/api/admin/users`: impossível alterar a si mesmo; não é possível rebaixar outro ADMIN.
- `admin-access-grant.tsx` é apenas o formulário — a autorização acontece toda no servidor.

## 15. Área /assinatura

Página `(app)/assinatura`: `requireOnboardedSession`, carrega `listPlans()`, `getMySubscription()`, `listMySubscriptions()`, `getAccessStatus()` e o estado real da integração (`isAsaasConfigured`/`asaasEnvironmentLabel` — sem revelar valores). O client (`assinatura-client.tsx`) exibe planos (preços server-side), estado atual, histórico e o botão de checkout; quando não configurado, mostra estado controlado "Pagamento online em configuração".

## 16. /admin/assinaturas

Painel admin: status da integração (configurado/não, ambiente, webhook), cards (assinaturas, total pago, pagamentos), tabela das últimas 100 assinaturas com **coluna Origem** (Manual/Asaas/—), valores em centavos formatados BRL, IDs externos mascarados e **Admin** mascarado para liberações manuais; tabela dos últimos 50 pagamentos.

## 17. Status Asaas em integrações

`/admin/integracoes`: card "Asaas (Billing)" agora reflete o estado real — "Cobranças reais acontecem quando ASAAS_API_KEY está definida" e status `Configurado`/`Não configurado` via `integrationEnvStatus(["ASAAS_API_KEY"])`. `asaasStatus()` (usado no admin) nunca revela chaves.

## 18. Webhook TikTok

`POST /api/webhooks/tiktok` agora é **fail-closed**:

- Sem `TIKTOK_CLIENT_SECRET` (ou verify token) → 503 (não aceita eventos).
- Lê `request.text()` **antes** do parse e valida `X-Signature` via `verifyWebhookSignature` (helper canônico `src/lib/webhooks/signature.ts`, HMAC-SHA256 com `TIKTOK_CLIENT_SECRET`) → 403 em assinatura inválida.
- Mantém rate limit e o GET do challenge (`echostr`/`token`).
- **Não inventou algoritmo:** usa exatamente o mesmo padrão já usado no Instagram (`X-Hub-Signature-256`); o helper documenta `X-Signature` (TikTok). A config do TikTok ainda está pendente (`TIKTOK_CLIENT_SECRET` não definido no .env local) — documentado abaixo.

## 19. Testes criados

`scripts/billing-tests.ts` (determinístico, node:assert, sem vitest/jest):

- **Catálogo:** 3 planos (sem Combo), preços 2700/7700/49700, tipos/ciclos/duração, features Instagram+TikTok, ativos.
- **Config:** sem chave → sandbox/PIX/não configurado; produção → rótulo; base URL sem barra; status nunca vaza a chave; trim.
- **Sanitização:** remove token/secret/access_/apikey/authorization em profundidade; preserva primitivos.
- **Webhook parser:** aceita PAYMENT_CONFIRMED e todos SUBSCRIPTION_*, aceita eventos conhecidos, rejeita desconhecidos e sem referência estável, eventId prioriza payment>subscription>customer, value→centavos, eventHasSubscription.
- **Cliente:** AsaasNotConfiguredError (fail-closed), AsaasHttpError sanitiza corpo e usa mensagem genérica para não-objeto, timeout 15000.
- **Liberação manual (núcleo):** constantes distinguem Manual/Asaas, limites 1..3650, normalizeEmail, validateGrantDays, computeGrantDates, computeExtendedExpiry (max(atual, agora)+dias), resolveAnchorPlanSlug.

**Resultado: 31/31 passando.**

## 20. Resultado dos testes

- `npm run billing:test` → **31 passaram, 0 falharam** (tsc billing-test EXIT 0 + node).
- `npm run growth:test` → **28/28** (regressão geral intacta).

## 21. Resultado tsc

`NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` → **EXIT 0** (projeto inteiro).

## 22. Resultado build

`npx next build` → **bloqueado no sandbox**: `Failed to load SWC binary for linux/x64` (binário nativo não baixado — sandbox sem rede/403). **A DONA deve rodar `npm run build` localmente.**

## 23. Pendências para Sandbox (DONA roda local)

| Comando | Estado |
|---|---|
| `npx prisma generate` | **Bloqueado no sandbox** (403 ao baixar engine). Rodar local. |
| `npx prisma validate` | Rodar local (confirma o schema). |
| `npx prisma db push` | **NÃO executar com `--accept-data-loss`.** Rodar local com revisão. |
| `npx prisma db seed` | Seed de planos (`seedPlanCatalog`) quando autorizado. |
| `npm run build` | Rodar local (SWC). |
| `npm run billing:test` / `npm run growth:test` | Já passam no sandbox (31/31 e 28/28). |

## 24. Variáveis de ambiente

Atualizadas no `.env.example` (seção Asaas):

| Variável | Uso | Segurança |
|---|---|---|
| `ASAAS_API_KEY` | access_token do Asaas | Só server-side, nunca no Git/logs/frontend |
| `ASAAS_BASE_URL` | URL base (vazia = padrão por ambiente) | — |
| `ASAAS_ENV` | `sandbox` (default) / `production` | — |
| `ASAAS_BILLING_TYPE` | `PIX` (default) / `BOLETO` / `CREDIT_CARD` | — |
| `ASAAS_WEBHOOK_TOKEN` | Token validado no webhook | Só server-side |

Nenhuma variável `NEXT_PUBLIC_ASAAS_*` existe. Relacionadas: `TIKTOK_CLIENT_SECRET`, `TIKTOK_WEBHOOK_VERIFY_TOKEN` (webhook TikTok), `AUTH_SECRET` (login).

## 25. O que configurar manualmente no painel Asaas

1. **API Key** (`ASAAS_API_KEY`) — painel Asaas → integrações/API.
2. **Webhook** — painel Asaas → Integrações → Webhook, apontando para `https://<DOMINIO>/api/webhooks/asaas`, com o **mesmo valor** de `ASAAS_WEBHOOK_TOKEN`; selecionar eventos de pagamento e assinatura.
3. **URLs de retorno/checkout** — o checkout usa URL de pagamento do Asaas (PIX/boleto/cartão) devolvida pela API; nenhum redirect de callback extra é necessário.
4. **Meio de cobrança** — definir `ASAAS_BILLING_TYPE` conforme a conta (PIX/BOLETO/CREDIT_CARD).
5. **Ambiente** — `ASAAS_ENV=sandbox` para testes (chave sandbox) ou `production` (chave de produção).
6. **Config do TikTok** — para o webhook TikTok, definir `TIKTOK_CLIENT_SECRET` e `TIKTOK_WEBHOOK_VERIFY_TOKEN` (mesmo valor no portal TikTok).

## 26. Impacto futuro na "ideia do primeiro acesso"

- A liberação manual **não cria conta** para e-mails sem cadastro (retorna `USER_NOT_FOUND`), deixando explicitamente a criação/convite/senha para a fase futura de "primeiro acesso".
- Os campos `accessSource` (ASAAS/ADMIN_MANUAL) e `provider` (asaas/manual) permitem **distinguir** acesso pago de acesso concedido — essencial para a futura regra de "primeiro acesso" (ex.: e-mail convidado pode criar senha; e-mail pago pode ativar diretamente).
- A `grantedByAdminId` + datas registradas formam a base de auditoria mínima que a fase futura poderá consultar.
- O webhook TikTok agora valida assinatura; a config real (chaves/verify token) permanece pendente para quando a integração for habilitada.

---

## Regra de parada

Nenhum commit/push/merge/deploy foi feito. O working tree está preservado (sem `git restore`). Entrega encerrada com este relatório — **PARAR**.
