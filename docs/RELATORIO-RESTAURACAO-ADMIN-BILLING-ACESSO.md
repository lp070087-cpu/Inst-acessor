# RELATÓRIO FINAL — Restauração dos Blocos 1, 2 e 3 (+ merge Prisma)

**Data:** 2026-09-12
**Fonte somente-leitura:** `_checkpoint-src\` (branch `checkpoint-fase8-fase9`)
**Base:** `main` atual (nada foi substituído integralmente)
**Nada foi commitado, nada foi enviado ao GitHub, nada foi publicado, nada foi aplicado no Neon.**

---

## 1. Arquivos recuperados

Total: **90 arquivos** recuperados da checkpoint (cópia fiel, sem invenção de conteúdo).

### 1.1 Admin — páginas (7)
`src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/usuarios/page.tsx`, `src/app/admin/assinaturas/page.tsx`, `src/app/admin/integracoes/page.tsx`, `src/app/admin/ia/page.tsx`, `src/app/admin/webhooks/page.tsx`

### 1.2 Admin — APIs (6)
`src/app/api/admin/overview/route.ts`, `usuarios/route.ts`, `access-grant/route.ts`, `access-grants/route.ts`, `ia/route.ts`, `ia/status/route.ts`

### 1.3 Admin — componentes (6)
`src/components/admin/admin-sidebar.tsx`, `admin-users-client.tsx`, `admin-access-grant.tsx`, `admin-access-grants.tsx`, `admin-ai-client.tsx`, `webhooks-copy-button.tsx`

### 1.4 Admin — libs (4 arquivos criados nesta rodada)
`src/lib/admin/settings-db.ts`, `src/lib/admin/ai-config.ts`, `src/lib/admin/stats.ts`, `src/lib/admin/index.ts`
`src/lib/auth/admin-access.ts` (já existia na main — preservado e usado como fonte da verdade do ADMIN)

### 1.5 Billing / Assinatura / Liberação manual (26)
`src/lib/billing/`: `db.ts`, `index.ts`, `manual-access.ts`, `manual-access-core.ts`, `plans/catalog.ts`, `plans/index.ts`, `subscriptions/index.ts`, `provider/index.ts`, `provider/types.ts`, `adapters/asaas.ts`
`src/lib/billing/asaas/`: `index.ts`, `config.ts`, `client.ts`, `types.ts`, `webhook.ts`, `events.ts`, `service.ts`, `hosted-checkout.ts`, `checkout-order.ts`
`src/lib/billing/infinitepay/`: `index.ts`, `config.ts`, `client.ts`, `webhook.ts`, `events.ts`
`src/app/api/billing/`: `checkout/route.ts`, `plans/route.ts`, `subscription/route.ts`
`src/app/api/webhooks/`: `asaas/route.ts`, `infinitepay/route.ts`
Páginas: `src/app/checkout/layout.tsx`, `src/app/checkout/page.tsx`, `src/app/checkout/checkout-form.tsx`, `src/app/checkout/retorno/page.tsx`, `src/app/(app)/assinatura/page.tsx`
Componentes de assinatura/cobrança em `src/components/billing/` (conforme checkpoint)
Validadores: `src/lib/validators/billing.ts`

### 1.6 Primeiro acesso / controle de acesso (13)
`src/lib/first-access/core.ts`, `src/lib/first-access/index.ts`
`src/app/api/first-access/`: `lookup/route.ts`, `request/route.ts`, `verify/route.ts`, `complete/route.ts`, `tour/route.ts`
`src/app/(auth)/primeiro-acesso/page.tsx`, `src/app/(auth)/primeiro-acesso/first-access-form.tsx`
`src/app/(auth)/expirado/page.tsx`
`src/lib/access/` (controle de acesso: `getActiveAccessForUser` + tipos de status)
`src/lib/validators/first-access.ts`
`src/lib/email/` (envio do token de primeiro acesso)
`src/app/api/admin/access-grants/route.ts` + `access-grant/route.ts` (liberação manual pelo ADMIN)

### 1.7 Dependência compartilhada de publishing (1, deliberado)
`src/lib/publishing/rate-limit.ts`
**Motivo:** é importado por rotas de ADMIN, webhooks e primeiro acesso (`createRateLimiter`, `clientIp`). Sem ele, os blocos 1–3 não compilam. **A feature de Publishing em si NÃO foi recuperada.**

### 1.8 Tipos / shims
`src/types/prisma-shim.d.ts` (delegate-cast para o padrão `type AnyPrismaClient = typeof prisma & Record<string, unknown>`)

---

## 2. Arquivos ALTERADOS da main (merge seletivo — 8)

| Arquivo | Alteração |
|---|---|
| `src/lib/auth/config.ts` | `authorize()` devolve `role`; `jwt` grava `token.role`; `session` expõe `session.user.role` |
| `src/lib/auth/guard.ts` | + `requireAdminSession()` (valida sessão + `status === "ACTIVE"` + `isOfficialAdminEmail`) |
| `src/types/next-auth.d.ts` | `Session.user.role` e `JWT.role` (`"USER" \| "ADMIN"`) |
| `src/lib/navigation.ts` | + `adminNavItem` (ícone `ShieldCheck`) |
| `src/components/layout/app-sidebar.tsx` | + prop `isAdmin`, item Admin no desktop e no drawer mobile |
| `src/app/(app)/layout.tsx` | detecção server-side de admin + gates de ativação/expiração + `isAdmin` no sidebar |
| `src/lib/validators/index.ts` | re-exporta `admin`, `billing`, `first-access` |
| `prisma/schema.prisma` | merge **aditivo** (ver item 17) |

**`src/lib/auth/password.ts` NÃO foi alterado** — a versão da main já é compatível (bcryptjs) e é a mais nova.

---

## 3. Admin restaurado

Páginas ativas: `/admin` (visão geral), `/admin/usuarios`, `/admin/assinaturas`, `/admin/integracoes`, `/admin/ia`, `/admin/webhooks`.
Navegação própria (`admin-sidebar.tsx`) + dados reais via `src/lib/admin/stats.ts` (`getAdminOverview()` — um único `Promise.all` com contagens de usuários, assinaturas, pagamentos, conexões IG/TikTok, fila de publicação, automações, grants manuais e primeiros acessos pendentes).

## 4. APIs Admin restauradas

`GET /api/admin/overview`, `GET /api/admin/users`, `POST /api/admin/access-grant`, `GET /api/admin/access-grants`, `GET/POST /api/admin/ia`, `GET /api/admin/ia/status`.

## 5. Proteção do Admin (server-side)

Em **duas camadas**:
1. `src/app/admin/layout.tsx` chama `requireAdminSession()` — quem não é o ADMIN oficial é redirecionado para `/dashboard` (não recebe 403 seco, não vê a tela).
2. **Todas as 6 rotas** de `/api/admin/*` começam por `requireAdminSession()` (14 ocorrências verificadas por leitura).

O corpo de `requireAdminSession()`: sessão válida + `user.status === "ACTIVE"` + `isOfficialAdminEmail(user.email)` contra `ADMIN_EMAIL`.
**Menu oculto para USER:** o item Admin só é renderizado se `isAdmin` — calculado **no servidor** em `src/app/(app)/layout.tsx` via `isOfficialAdminEmail(user?.email ?? null)` e passado como prop. Nenhuma decisão de admin é tomada no cliente.
**Um único ADMIN principal:** `src/lib/auth/admin-access.ts` valida contra `ADMIN_EMAIL`; nenhuma role `ADMIN` é atribuída em massa; `role` no token é sempre `"USER"` por padrão.

## 6. Billing restaurado

Models `Plan`, `Subscription`, `Payment`, `BillingEvent`, `CheckoutOrder`, `AccessGrant`; catálogo de planos; `src/lib/billing/plans/index.ts` (`ensureCatalogPlans`); `src/lib/billing/db.ts` (delegates `bll.*`); `src/lib/billing/subscriptions/index.ts`; `src/lib/billing/manual-access.ts` + `manual-access-core.ts`; páginas `/assinatura`, `/checkout`, `/checkout/retorno`; APIs `/api/billing/{plans,checkout,subscription}`; webhooks `/api/webhooks/{asaas,infinitepay}`.

## 7. Gateway FINAL (decisão, com justificativa)

A checkpoint contém comentários **contraditórios**. A comparação apontou o caminho mais novo:

- `src/lib/billing/plans/catalog.ts` **removeu** o campo `checkoutUrl` → planos não são mais links estáticos.
- `src/lib/billing/plans/index.ts` criou `ensureCatalogPlans()` → planos passam a ser **registros no banco**.
- `src/lib/billing/db.ts` expõe o delegate `checkoutOrder`.
- `src/lib/billing/asaas/checkout-order.ts` + `hosted-checkout.ts` implementam **`POST /v3/checkouts`** (checkout hospedado do Asaas).

**Gateway ativo = Asaas hosted checkout.** `src/lib/billing/adapters/asaas.ts` e `src/lib/billing/asaas/service.ts` estão rotulados "LEGADO" na própria checkpoint e foram **preservados, não promovidos**. O InfinitePay (Ana/`INFINITEPAY_*`) também foi restaurado, mas **fora dos fluxos ativos** — honrando "Preserve o trabalho recente do Asaas".

## 8. Planos

`PLAN_CATALOG` (3 planos, sem Combo): `semanal` — "Inst acessor Semanal" — 2700; `mensal` — "Inst acessor mensal" — 7700; `anual` — "Inst acessor Anual" — **54700** (já com o reajuste). `ensureCatalogPlans()` é idempotente (upsert por slug).

## 9. Checkout

`/checkout` é **rota pública** (existe fora de `(app)`), com layout próprio, `checkout-form.tsx` e página de retorno `/checkout/retorno`. A API `/api/billing/checkout` cria o `CheckoutOrder` e devolve a URL do checkout hospedado do Asaas.

## 10. Webhook

`POST /api/webhooks/asaas` com **idempotência por `eventId`** (`BillingEvent`), processamento por tipo de evento (`src/lib/billing/asaas/events.ts`), payloads sanitizados (nunca token/segredo), e fail-closed quando `ASAAS_WEBHOOK_TOKEN` não confere. `POST /api/webhooks/infinitepay` restaurado no mesmo padrão, inativo no fluxo.

## 11. Assinatura

`/assinatura` (área do cliente) com as duas áreas (plano atual/cobrança + histórico), lendo `Subscription`, `Payment` e `BillingEvent`. API `/api/billing/subscription` (sessão do próprio usuário).

## 12. AccessGrant

Model `AccessGrant` com ciclo de vida `PENDING_FIRST_ACCESS | ACTIVE | EXPIRED | CANCELED` e origem `ASAAS | ADMIN_MANUAL`. Criado no webhook (origem `ASAAS`) ou pelo ADMIN (origem `ADMIN_MANUAL`, `grantedByAdminId`).

## 13. 7 / 30 / personalizado

`src/components/admin/admin-access-grant.tsx`: presets `7 dias`, `30 dias`, `90 dias` + campo de **duração personalizada** em dias. `manual-access-core.ts` valida inteiro entre `MANUAL_MIN_DAYS = 1` e `MANUAL_MAX_DAYS = 3650`. O plano-âncora é derivado da duração (`resolveAnchorPlanSlug`: ≤7 → `semanal`, ≤45 → `mensal`, resto → `anual`) — **a fonte de verdade da duração é `expiresAt`, não o plano**.

## 14. Extensão e revogação

**Extensão:** se já existe assinatura manual ativa, o novo vencimento é `max(vencimento atual, agora) + dias` (`computeExtendedExpiry`) — estender nunca "rouba" o período já concedido; retorno marcado `extended: true`. `POST /api/admin/access-grant` também aceita operação de revogação/cancelamento, registrando status `CANCELED` **sem apagar histórico de pagamentos**.

## 15. Primeiro Acesso

Fluxo completo: `lookup` (e-mail autorizado? conta existe?) → `request` (gera token opaco de uso único, **hash SHA-256** em `FirstAccessToken.tokenHash`, envio por e-mail) → `verify` → `complete` (cria senha com **bcrypt**, nunca senha automática) → `tour` (5 passos). Página `/primeiro-acesso` + `first-access-form.tsx`, e `/expirado` para acesso vencido/cancelado.
**Loop `/dashboard ↔ /primeiro-acesso` não existe:** o gate em `(app)/layout.tsx` é `access.status === "PENDING_FIRST_ACCESS" && !user?.passwordHash`; a página só redireciona para `/dashboard` quando **já existe** `passwordHash`. Os dois lados concordam.

## 16. Controle de acesso

`getActiveAccessForUser(userId)` em `src/lib/access/` é a **única** fonte de decisão. Em `src/app/(app)/layout.tsx`: sem acesso ativo e sem senha → `/primeiro-acesso`; `EXPIRED` ou `CANCELED` → `/expirado`. **Nada disso bloqueia rotas públicas**, porque `src/middleware.ts` é um matcher estático que cobre só `(app)` + login/cadastro/onboarding — e verifiquei que ele **não** inclui `/admin`, `/checkout`, `/primeiro-acesso`, `/expirado` nem `/api/*`.

Rotas confirmadamente **não bloqueadas:** login, cadastro, primeiro-acesso, checkout, callbacks OAuth (IG e TikTok), webhooks (Asaas, InfinitePay, Instagram, TikTok), páginas legais e demais rotas públicas.

## 17. Prisma alterado (merge ADITIVO, sem substituição)

Resultado final: **54 models + 3 enums**. Instagram/TikTok **byte-idênticos** à main.

- `User` ganhou: `asaasCustomerId` (unique), `firstAccessCompleted`, `firstAccessCompletedAt`, `tourCompleted`, `tourCompletedAt` + as relações correspondentes.
- Inseridos 23 models novos: `Plan`, `Subscription`, `Payment`, `BillingEvent`, `CheckoutOrder`, `AccessGrant`, `FirstAccessToken`, `SystemSetting`, `UserGoal`, `PlannedContent`, `PlannedContentExperiment`, `ContentCopyVersion`, `UserLevel`, `XpLog`, `Achievement`, `UserAchievement`, `PublishQueue`, `PublishLog`, `AutomationRule`, `AutomationEvent`, `AutomationExecution`, `GrowthAction`, `PasskeyCredential`.
- Nenhum `DROP`, nenhuma coluna removida, nenhum enum alterado, nenhum model existente renomeado.

**Por que o merge é maior que o mínimo:** `src/lib/admin/stats.ts` — restaurado fielmente — conta métricas **reais** de `publishQueue`, `automationRule`, `growthAction`, `accessGrant`. Editar esse arquivo funcional violaria "restaurar as libs Admin" e, pior, deixaria tabelas já existentes no Neon órfãs. Também confirmei que o client Prisma já gerado em `node_modules` contém esses models — rodar `prisma generate` contra o schema antigo faria **downgrade** de tipos. O merge aditivo resolve os dois problemas e nunca quebra build nem perde dado.

## 18. Migration criada (NÃO aplicada)

`prisma/migrations/20260912130000_admin_billing_primeiro_acesso/migration.sql` + `prisma/migrations/migration_lock.toml`.
**14 seções, 100% aditivas** — nenhum `DROP`, nenhum `DELETE`, nenhuma coluna removida. Cabeçalho explícito: "⚠️ NÃO APLICADA".
Corrigi um bug de ordenação que peguei por leitura estática: `PublishQueue` tem FK para `PlannedContent` e estava criada **antes** dela — o SQL falharia. Movida para a seção 13, depois de `PlannedContent`. Verifiquei que todos os alvos de `REFERENCES` são criados antes de suas FKs.

**Decisão adicional:** `prisma/migrations/` **não existia** no projeto (o padrão do repo é `prisma db push` via `npm run prisma:push`). Criei a pasta porque você pediu migration incremental — mas isso não obriga a usá-la: o `db push` do schema novo produz o mesmo resultado.

## 19. Ações no Neon

**NENHUMA.** Nenhum `db push`, `migrate dev`, `migrate deploy`, `migrate resolve`, `db execute`, `force-reset`, seed ou query. Nenhuma tabela criada, alterada ou apagada. Nenhum dado lido ou escrito.

## 20. Variáveis de ambiente necessárias (somente os nomes)

Novas/afetadas pelos blocos 1–3: `ADMIN_EMAIL`, `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BILLING_TYPE`, `TOKEN_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`.
Já existentes e apenas reutilizadas: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `SITE_URL`, `RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_SCOPES`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_VERIFY_TOKEN`, `INFINITEPAY_API_KEY`, `INFINITEPAY_WEBHOOK_TOKEN`, `INFINITEPAY_ACCOUNT_ID`.
(`META_APP_ID` / `META_APP_SECRET` aparecem apenas como fallback de compatibilidade em `instagram/client.ts` e `admin/integracoes` — o par prioritário é `INSTAGRAM_APP_*`.)
**Somente nomes — nenhum valor foi lido, exibido ou alterado.**

## 21. TypeScript

**NÃO EXECUTADO.** O sandbox Linux permaneceu indisponível durante toda a rodada ("Workspace unavailable"), e você autorizou expressamente: "Se o sandbox continuar quebrado, não insista. Eu farei a validação no Windows." Não insisti. Toda a verificação foi **estática**, por leitura e grep: imports resolvidos, páginas existentes, rotas presentes, sem referências pendentes.

## 22. Build

**NÃO EXECUTADO** pelo mesmo motivo (e também porque o `node_modules` é do Windows — o build real só roda no seu host).

## 23. Pendências

1. **Rodar `npx prisma generate`** — obrigatório antes de qualquer `tsc`/build. Sem isso, `src/lib/admin/stats.ts` (que usa `prisma.subscription`, `prisma.publishQueue`, etc.) quebra o typecheck.
2. Aplicar o schema no Neon (via `npm run prisma:push` **ou** a migration — decida um dos dois; não os dois).
3. Validar no Windows: `npx tsc --noEmit` e `npm run build`.
4. Conferir se `ADMIN_EMAIL` está definido no ambiente local e na Vercel — sem ele **ninguém** entra em `/admin`.
5. `ASAAS_WEBHOOK_TOKEN` e `TOKEN_ENCRYPTION_KEY` (≥32 caracteres) precisam existir, senão a IA admin retorna "Configuração pendente" e o webhook falha fechado (comportamento correto, mas precisa saber).
6. Ainda **não recuperados** (por sua ordem): Publishing, Rank, Calendário, Automações, Landing.
7. `prisma/migrations/` passou a existir onde antes não existia — se você usar `prisma db push`, a pasta fica só como documentação.

## 24. Confirmação — Instagram Business Login preservado

**CONFIRMADO.** A integração Instagram Business Login atual da `main` é a fonte de verdade e **não foi tocada**. **Nenhum** arquivo foi recuperado de `_checkpoint-src\src\app\api\integrations\instagram\`, `_checkpoint-src\src\lib\integrations\instagram\` ou `_checkpoint-src\src\components\integrations\instagram-actions.tsx`.

Não foram sobrescritos: `src/app/api/integrations/instagram/**`, `src/lib/integrations/instagram/**`, `src/components/integrations/instagram-actions.tsx`, `src/components/integrations/connected-account-card.tsx`, `src/app/(app)/redes-sociais/page.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/dashboard-client.tsx`, `src/lib/dashboard/instagram-data.ts`, `src/lib/dashboard/tiktok-data.ts`, `src/lib/config/site.ts`.

Evidência: `src/lib/integrations/instagram/client.ts` continua usando `graph.instagram.com` e `api.instagram.com` com `INSTAGRAM_APP_ID`, e mantém o comentário explícito de que **não** usa `graph.facebook.com` nem o dialog de Facebook Login. `src/lib/config/site.ts` (com `getAppBaseUrl()`) está intacto.

---

## Encerramento

Nada foi commitado. Nada foi enviado ao GitHub. Nada foi publicado. Nada foi aplicado no Neon. `_checkpoint-src\` não foi modificado nem apagado e **não foi adicionado ao Git**.
